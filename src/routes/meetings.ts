import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { authRequired } from '../middleware/auth';
import { s3Service } from '../services/s3';
import { ddbService } from '../services/ddb';

const router = Router();

const maxUploadMB = parseInt(process.env.UPLOAD_MAX_MB || '300');

// Configure multer for file uploads (temp storage only)
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: maxUploadMB * 1024 * 1024 }
});

/**
 * POST /v1/meetings
 * Upload a new meeting video
 */
router.post('/', authRequired, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Video file required' });
    }
    
    const meetingId = uuidv4();
    const title = req.body.title || `Meeting ${new Date().toISOString().split('T')[0]}`;
    const userId = req.user!.sub;
    
    // Define S3 prefix for this meeting
    const s3Prefix = `meetings/${meetingId}`;
    
    // Upload file to S3
    const fileBuffer = fs.readFileSync(req.file.path);
    const fileExtension = req.file.originalname.split('.').pop() || 'mp4';
    const s3Key = `${s3Prefix}/input.${fileExtension}`;
    
    await s3Service.putObject(
      s3Key,
      fileBuffer,
      req.file.mimetype || 'video/mp4'
    );
    
    // Clean up temp file
    fs.unlinkSync(req.file.path);
    
    // Save meeting metadata to DynamoDB
    await ddbService.createMeeting({
      id: meetingId,
      title,
      status: 'uploaded',
      s3Prefix,
      created_at: new Date().toISOString(),
      originalFilename: req.file.originalname,
      userId
    });
    
    res.json({ 
      meetingId,
      message: 'Meeting uploaded successfully'
    });
  } catch (error: any) {
    console.error('Meeting creation error:', error?.message || error);
    res.status(500).json({ error: 'Failed to create meeting' });
  }
});

/**
 * GET /v1/meetings
 * List all meetings
 */
router.get('/', authRequired, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    
    const meetings = await ddbService.listMeetings(limit);
    
    // Sort by created_at descending
    meetings.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });
    
    res.json({
      meetings,
      pagination: {
        limit,
        hasMore: meetings.length === limit
      }
    });
  } catch (error) {
    console.error('Meetings list error:', error);
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
});

/**
 * GET /v1/meetings/:id
 * Get meeting details with presigned URLs
 */
router.get('/:id', authRequired, async (req, res) => {
  try {
    const meetingId = req.params.id;
    
    // Get meeting from DynamoDB
    const meeting = await ddbService.getMeeting(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    // Get related items
    const renditions = await ddbService.getRenditions(meetingId);
    const captions = await ddbService.getCaptions(meetingId);
    const actions = await ddbService.getActions(meetingId);
    
    // Generate presigned URLs for files
    const fileUrls: any = {};
    const thumbnails: string[] = [];
    
    // Original input file
    const inputExtension = meeting.originalFilename?.split('.').pop() || 'mp4';
    try {
      fileUrls.original = await s3Service.getPresignedGetUrl(
        `${meeting.s3Prefix}/input.${inputExtension}`
      );
    } catch (err) {
      console.log('Original file not found in S3');
    }
    
    // Renditions
    for (const rendition of renditions) {
      try {
        fileUrls[rendition.resolution] = await s3Service.getPresignedGetUrl(rendition.key);
      } catch (err) {
        console.log(`Rendition ${rendition.resolution} not found`);
      }
    }
    
    // Captions
    if (captions) {
      if (captions.srtKey) {
        try {
          fileUrls.srt = await s3Service.getPresignedGetUrl(captions.srtKey);
        } catch (err) {
          console.log('SRT file not found');
        }
      }
      if (captions.vttKey) {
        try {
          fileUrls.vtt = await s3Service.getPresignedGetUrl(captions.vttKey);
        } catch (err) {
          console.log('VTT file not found');
        }
      }
    }
    
    // Note: Thumbnails would need to be tracked separately in DDB
    // For now, we'll include an empty array
    // TODO: Implement thumbnail tracking in DDB
    
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