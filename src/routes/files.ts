import { Router } from 'express';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authRequired, requireGroup } from '../middleware/auth';
import { s3Service } from '../services/s3';

const router = Router();

// JSON parsing middleware
router.use(express.json());

/**
 * POST /v1/files/presign-upload
 * Generate a presigned URL for direct upload to S3
 * 
 * Body: { fileName: string, fileType: string }
 * Returns: { uploadUrl: string, key: string }
 * 
 * REQUIRES: Authentication (all users can upload)
 */
router.post('/presign-upload', authRequired, async (req, res) => {
  try {
    const { fileName, fileType } = req.body;

    if (!fileName || !fileType) {
      return res.status(400).json({ 
        error: 'fileName and fileType are required' 
      });
    }

    // Generate unique meeting ID for this upload
    const meetingId = uuidv4();
    
    // Construct S3 key: meetings/{uuid}/{fileName}
    const key = `meetings/${meetingId}/${fileName}`;

    // Generate presigned PUT URL (expires in 15 minutes)
    const uploadUrl = await s3Service.getPresignedPutUrl(key, fileType, 900);

    res.json({
      uploadUrl,
      key,
      meetingId,
      expiresIn: 900 // 15 minutes in seconds
    });
  } catch (error: any) {
    console.error('Presigned upload URL generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate presigned upload URL',
      details: error.message 
    });
  }
});

/**
 * GET /v1/files/presign-download/:key
 * Generate a presigned URL for downloading a file from S3
 * 
 * Path param: key - S3 object key (URL-encoded)
 * Returns: { downloadUrl: string }
 */
router.get('/presign-download/:key(*)', authRequired, async (req, res) => {
  try {
    // The :key(*) pattern captures the entire path including slashes
    const key = req.params.key;

    if (!key) {
      return res.status(400).json({ 
        error: 'Object key is required' 
      });
    }

    // Generate presigned GET URL (expires in 15 minutes)
    const downloadUrl = await s3Service.getPresignedGetUrl(key, 900);

    res.json({
      downloadUrl,
      key,
      expiresIn: 900 // 15 minutes in seconds
    });
  } catch (error: any) {
    console.error('Presigned download URL generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate presigned download URL',
      details: error.message 
    });
  }
});

export default router;

