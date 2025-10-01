import { Router } from 'express';
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { authRequired, requireGroup } from '../middleware/auth';
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
 * Create a new meeting from either:
 * 1. Presigned upload (JSON body with sourceKey) - PREFERRED
 * 2. Direct multipart upload (fallback for compatibility)
 * 
 * REQUIRES: Authentication (all users can upload)
 */
router.post('/', authRequired, express.json(), async (req, res, next) => {
  // Check if this is a presigned upload flow (JSON with sourceKey)
  if (req.body && req.body.sourceKey) {
    try {
      const { sourceKey, title } = req.body;
      const userId = req.user!.sub;

      // Extract meetingId from sourceKey: meetings/{meetingId}/{fileName}
      const keyParts = sourceKey.split('/');
      if (keyParts.length < 3 || keyParts[0] !== 'meetings') {
        return res.status(400).json({ error: 'Invalid sourceKey format' });
      }

      const meetingId = keyParts[1];
      const fileName = keyParts.slice(2).join('/');
      const s3Prefix = `meetings/${meetingId}`;

      // Save meeting metadata to DynamoDB
      await ddbService.createMeeting({
        id: meetingId,
        title: title || `Meeting ${new Date().toISOString().split('T')[0]}`,
        status: 'uploaded',
        s3Prefix,
        created_at: new Date().toISOString(),
        originalFilename: fileName,
        userId
      });

      return res.json({
        meetingId,
        message: 'Meeting registered successfully'
      });
    } catch (error: any) {
      console.error('Meeting registration error:', error?.message || error);
      return res.status(500).json({ error: 'Failed to register meeting' });
    }
  }

  // Otherwise, handle as multipart upload (fallback)
  upload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

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

/**
 * DELETE /v1/meetings/:id
 * Delete a meeting and all associated files
 * Users can delete their own uploads, Admins can delete any meeting
 */
router.delete('/:id', authRequired, async (req, res) => {
  try {
    const meetingId = req.params.id;
    const userId = req.user!.sub;
    const userGroups = req.user!['cognito:groups'] || [];
    const isAdmin = userGroups.includes('Admin');
    
    // Get meeting to check ownership
    const meeting = await ddbService.getMeeting(meetingId);
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    // Check authorization: user must own the meeting OR be an Admin
    if (meeting.userId !== userId && !isAdmin) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You can only delete your own meetings'
      });
    }
    
    // Delete all items from DynamoDB for this meeting
    // This includes: MEETING, CAPTIONS, RENDITIONS, and all ACTION items
    let deletedCount = 0;
    
    // 1. Delete the main MEETING item
    try {
      await ddbService.deleteItem(`MEETING#${meetingId}`);
      deletedCount++;
      console.log(`✅ Deleted MEETING#${meetingId}`);
    } catch (err) {
      console.log(`⚠️  MEETING#${meetingId} not found or already deleted`);
    }
    
    // 2. Delete CAPTIONS
    try {
      await ddbService.deleteItem(`CAPTIONS#${meetingId}`);
      deletedCount++;
      console.log(`✅ Deleted CAPTIONS#${meetingId}`);
    } catch (err) {
      console.log(`⚠️  CAPTIONS#${meetingId} not found`);
    }
    
    // 3. Delete all RENDITIONS (query with prefix)
    try {
      const renditions = await ddbService.queryByPrefix(`REND#${meetingId}#`);
      for (const rend of renditions) {
        await ddbService.deleteItem(rend.sk);
        deletedCount++;
        console.log(`✅ Deleted rendition ${rend.sk}`);
      }
    } catch (err) {
      console.log(`⚠️  No renditions found for ${meetingId}`);
    }
    
    // 4. Delete all ACTIONS (query with prefix)
    try {
      const actions = await ddbService.queryByPrefix(`ACTION#${meetingId}#`);
      for (const action of actions) {
        await ddbService.deleteItem(action.sk);
        deletedCount++;
        console.log(`✅ Deleted action ${action.sk}`);
      }
    } catch (err) {
      console.log(`⚠️  No actions found for ${meetingId}`);
    }
    
    console.log(`🗑️  Deleted meeting ${meetingId} - total ${deletedCount} items removed from DynamoDB`);
    
    // Note: We're NOT deleting S3 files to preserve data
    // If you want to delete S3 files as well, uncomment below:
    /*
    try {
      const s3Prefix = meeting.s3Prefix;
      // Delete all objects with this prefix from S3
      // This would require listing and deleting all objects
      console.log(`Would delete S3 objects with prefix: ${s3Prefix}`);
    } catch (s3Error) {
      console.error('S3 deletion error:', s3Error);
      // Continue even if S3 deletion fails
    }
    */
    
    res.json({ 
      success: true,
      message: 'Meeting deleted successfully',
      deletedItems: deletedCount
    });
  } catch (error: any) {
    console.error('Meeting deletion error:', error);
    res.status(500).json({ 
      error: 'Failed to delete meeting',
      details: error.message 
    });
  }
});

export default router;