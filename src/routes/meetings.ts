import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { authRequired, requireRole } from '../middleware/auth';
import { dbHelpers } from '../services/db';
import { config } from '../config';

const router = Router();

function moveFileSafe(src: string, dest: string) {
  try {
    fs.renameSync(src, dest);
  } catch (err: any) {
    // Cross-device or permission edge cases: fall back to copy+unlink
    if (err && (err.code === 'EXDEV' || err.code === 'EPERM' || err.code === 'EACCES')) {
      fs.copyFileSync(src, dest);
      fs.unlinkSync(src);
    } else {
      throw err;
    }
  }
}

const maxUploadMB = parseInt(process.env.UPLOAD_MAX_MB || '300');

// Configure multer for file uploads
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: maxUploadMB * 1024 * 1024 }
});

router.post('/', authRequired, requireRole('editor'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Video file required' });
    }
    
    const meetingId = uuidv4();
    const title = req.body.title || `Meeting ${new Date().toISOString().split('T')[0]}`;
    const userId = req.user!.sub;
    
    // Create meeting directory
    const meetingDir = path.join(config.dataDir, 'meetings', meetingId);
    fs.mkdirSync(meetingDir, { recursive: true });
    
    // Move uploaded file to meeting directory
    const inputPath = path.join(meetingDir, 'input.mp4');
    moveFileSafe(req.file.path, inputPath);
    
    // Save to database
    dbHelpers.createMeeting(meetingId, userId, title, req.file.originalname);
    
    res.json({ meetingId });
  } catch (error: any) {
    console.error('Meeting creation error:', error?.message || error);
    res.status(500).json({ error: 'Failed to create meeting' });
  }
});

router.get('/', authRequired, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const sortBy = (req.query.sortBy as string) || 'created_at';
    const order = ((req.query.order as string) || 'desc').toUpperCase();
    
    const offset = (page - 1) * limit;
    
    const meetings = dbHelpers.getMeetings(limit, offset, sortBy, order);
    
    res.json({
      meetings,
      pagination: {
        page,
        limit,
        hasMore: meetings.length === limit
      }
    });
  } catch (error) {
    console.error('Meetings list error:', error);
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
});

router.get('/:id', authRequired, async (req, res) => {
  try {
    const meetingId = req.params.id;
    
    const meeting = dbHelpers.getMeetingById(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    const renditions = dbHelpers.getRenditionsByMeeting(meetingId) as Array<{ path: string; resolution: string; size_bytes: number }>;
    const captions = dbHelpers.getCaptionsByMeeting(meetingId);
    const actions = dbHelpers.getActionsByMeeting(meetingId);
    
    // Generate file URLs
    const meetingDir = path.join(config.dataDir, 'meetings', meetingId);
    const fileUrls: any = {};
    
    if (fs.existsSync(path.join(meetingDir, 'input.mp4'))) {
      fileUrls.original = `/files/meetings/${meetingId}/input.mp4`;
    }
    
    renditions.forEach((r) => {
      const filename = path.basename(r.path);
      fileUrls[r.resolution] = `/files/meetings/${meetingId}/${filename}`;
    });
    
    if (captions) {
      if (fs.existsSync(path.join(meetingDir, 'captions.srt'))) {
        fileUrls.srt = `/files/meetings/${meetingId}/captions.srt`;
      }
      if (fs.existsSync(path.join(meetingDir, 'captions.vtt'))) {
        fileUrls.vtt = `/files/meetings/${meetingId}/captions.vtt`;
      }
    }
    
    // Add thumbnails
    const thumbnails = fs.existsSync(meetingDir) ? 
      fs.readdirSync(meetingDir)
        .filter(file => file.startsWith('thumbs_') && file.endsWith('.jpg'))
        .map(file => `/files/meetings/${meetingId}/${file}`)
        .sort() : [];
    
    res.json({
      ...meeting,
      renditions,
      captions,
      actions,
      fileUrls,
      thumbnails
    });
  } catch (error) {
    console.error('Meeting details error:', error);
    res.status(500).json({ error: 'Failed to fetch meeting details' });
  }
});

export default router;