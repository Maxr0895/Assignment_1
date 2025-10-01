import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authRequired, requireGroup } from '../middleware/auth';
import { s3Service } from '../services/s3';
import { ddbService } from '../services/ddb';
import { FFmpegService } from '../services/ffmpegService';
import { OpenAIService } from '../services/openaiService';
import { ActionsFallbackService } from '../services/actionsFallback';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { config } from '../config';
import { makeTempDir, cleanupDir } from '../utils/temp';

const router = Router();
const ffmpegService = new FFmpegService();
const openaiService = new OpenAIService();
const fallbackService = new ActionsFallbackService();

const s3Client = new S3Client({ region: config.awsRegion });

// Scoped JSON parsing for this router
router.use((req, res, next) => {
  (require('express') as typeof import('express')).json()(req, res, next);
});

/**
 * POST /v1/meetings/:id/transcode
 * Transcode video: download from S3, process with ffmpeg, upload outputs to S3
 * Supports idempotency via Idempotency-Key header
 */
// Note: MFA enforcement removed due to USER_PASSWORD_AUTH flow limitation (doesn't include amr claim)
// MFA is still enforced at enrollment and frontend UI level
router.post('/:id/transcode', authRequired, requireGroup('Admin'), async (req, res) => {
  let tempDir: string | null = null;
  const meetingId = req.params.id;
  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
  
  try {
    // Check idempotency
    if (idempotencyKey) {
      const existing = await ddbService.checkIdempotencyKey(idempotencyKey);
      if (existing && existing.operation === 'transcode' && existing.meetingId === meetingId) {
        console.log(`🔁 Returning cached result for idempotency key: ${idempotencyKey}`);
        return res.json(existing.result);
      }
    }

    // Get meeting from DynamoDB
    const meeting = await ddbService.getMeeting(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    // Update status to processing
    await ddbService.updateMeeting(meetingId, { status: 'processing' });
    
    // Create temp directory
    tempDir = await makeTempDir('transcode');
    
    // Download input from S3
    // Use the actual uploaded filename (for presigned uploads) or default to input.{ext}
    const originalFilename = meeting.originalFilename || 'input.mp4';
    const inputExtension = originalFilename.split('.').pop() || 'mp4';
    const inputS3Key = `${meeting.s3Prefix}/${originalFilename}`;
    const inputTempPath = path.join(tempDir, `input.${inputExtension}`);
    
    console.log(`📥 Downloading from S3: ${inputS3Key}`);
    const getCommand = new GetObjectCommand({
      Bucket: config.s3Bucket,
      Key: inputS3Key
    });
    const s3Response = await s3Client.send(getCommand);
    const inputStream = s3Response.Body as any;
    const writeStream = fs.createWriteStream(inputTempPath);
    await new Promise((resolve, reject) => {
      inputStream.pipe(writeStream);
      inputStream.on('error', reject);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
    
    console.log('🎬 Starting ffmpeg transcode...');
    const result = await ffmpegService.transcodeVideo(inputTempPath, tempDir);
    
    // Upload renditions to S3 (idempotent - same keys)
    console.log('📤 Uploading renditions to S3...');
    const renditionData = [];
    for (const rendition of result.renditions) {
      const filename = path.basename(rendition.path);
      const s3Key = `${meeting.s3Prefix}/${filename}`;
      
      const fileBuffer = fs.readFileSync(rendition.path);
      await s3Service.putObject(s3Key, fileBuffer, 'video/mp4');
      
      // Save rendition metadata to DynamoDB
      await ddbService.createRendition({
        meetingId,
        resolution: rendition.resolution,
        key: s3Key,
        sizeBytes: rendition.size_bytes
      });
      
      renditionData.push({
        resolution: rendition.resolution,
        key: s3Key,
        size_bytes: rendition.size_bytes
      });
    }
    
    // Upload audio to S3 (idempotent - same key)
    const audioPath = path.join(tempDir, 'audio.mp3');
    if (fs.existsSync(audioPath)) {
      const audioKey = `${meeting.s3Prefix}/audio.mp3`;
      const audioBuffer = fs.readFileSync(audioPath);
      await s3Service.putObject(audioKey, audioBuffer, 'audio/mpeg');
    }
    
    // Upload thumbnails to S3 (idempotent - same keys)
    const thumbnailUrls = [];
    for (const thumb of result.thumbnails) {
      const filename = path.basename(thumb);
      const s3Key = `${meeting.s3Prefix}/${filename}`;
      
      const thumbBuffer = fs.readFileSync(thumb);
      await s3Service.putObject(s3Key, thumbBuffer, 'image/jpeg');
      
      const presignedUrl = await s3Service.getPresignedGetUrl(s3Key);
      thumbnailUrls.push(presignedUrl);
    }
    
    // Update meeting metadata - status = done
    await ddbService.updateMeeting(meetingId, {
      duration_s: result.duration_s,
      status: 'done'
    });
    
    // Generate presigned URLs for response
    const renditionUrls = await Promise.all(
      renditionData.map(async (r) => ({
        resolution: r.resolution,
        url: await s3Service.getPresignedGetUrl(r.key),
        size_bytes: r.size_bytes
      }))
    );
    
    const audioUrl = await s3Service.getPresignedGetUrl(`${meeting.s3Prefix}/audio.mp3`);
    
    const responseData = {
      renditions: renditionUrls,
      audioUrl,
      thumbnails: thumbnailUrls,
      duration_s: result.duration_s
    };

    // Store idempotency key if provided
    if (idempotencyKey) {
      await ddbService.storeIdempotencyKey(idempotencyKey, meetingId, 'transcode', responseData);
    }

    res.json(responseData);
  } catch (error) {
    console.error('Transcoding error:', error);
    
    // Update status to failed with error message
    await ddbService.updateMeeting(meetingId, { 
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({ 
      error: 'Transcoding failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    // Always clean up temp files
    if (tempDir) {
      await cleanupDir(tempDir);
    }
  }
});

/**
 * POST /v1/meetings/:id/transcribe
 * Transcribe audio: download from S3, transcribe, upload captions to S3
 * Supports idempotency via Idempotency-Key header
 */
router.post('/:id/transcribe', authRequired, requireGroup('Admin'), async (req, res) => {
  let tempDir: string | null = null;
  const meetingId = req.params.id;
  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
  
  try {
    // Check idempotency
    if (idempotencyKey) {
      const existing = await ddbService.checkIdempotencyKey(idempotencyKey);
      if (existing && existing.operation === 'transcribe' && existing.meetingId === meetingId) {
        console.log(`🔁 Returning cached result for idempotency key: ${idempotencyKey}`);
        return res.json(existing.result);
      }
    }

    const { manualTranscript } = req.body;
    
    const meeting = await ddbService.getMeeting(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    let segments: any[] = [];
    
    // Create temp directory
    tempDir = await makeTempDir('transcribe');
    
    // Download audio from S3 for transcription
    const audioS3Key = `${meeting.s3Prefix}/audio.mp3`;
    const audioTempPath = path.join(tempDir, 'audio.mp3');
    
    if (await openaiService.isAvailable() && !manualTranscript) {
      try {
        console.log('📥 Downloading audio from S3...');
        const getCommand = new GetObjectCommand({
          Bucket: config.s3Bucket,
          Key: audioS3Key
        });
        const s3Response = await s3Client.send(getCommand);
        const audioStream = s3Response.Body as any;
        const writeStream = fs.createWriteStream(audioTempPath);
        await new Promise((resolve, reject) => {
          audioStream.pipe(writeStream);
          audioStream.on('error', reject);
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });
        
        console.log('🎤 Attempting OpenAI transcription...');
        segments = await openaiService.transcribeAudio(audioTempPath);
        console.log('✅ OpenAI transcription successful');
      } catch (error) {
        console.error('❌ OpenAI transcription failed:', error instanceof Error ? error.message : error);
        console.log('💡 Please provide a manual transcript to continue');
        return res.status(400).json({ 
          error: 'OpenAI transcription failed. Please provide a manual transcript.',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } else if (manualTranscript) {
      console.log('Using manual transcript provided by user');
      segments = [{
        start: 0,
        end: meeting.duration_s || 0,
        text: manualTranscript
      }];
    } else {
      return res.status(400).json({ 
        error: 'OpenAI not available and no manual transcript provided' 
      });
    }
    
    // Generate caption files
    const captions = openaiService.generateCaptions(segments);
    
    const srtPath = path.join(tempDir, 'captions.srt');
    const vttPath = path.join(tempDir, 'captions.vtt');
    
    fs.writeFileSync(srtPath, captions.srt);
    fs.writeFileSync(vttPath, captions.vtt);
    
    // Upload captions to S3 (idempotent - same keys)
    const srtKey = `${meeting.s3Prefix}/captions.srt`;
    const vttKey = `${meeting.s3Prefix}/captions.vtt`;
    
    await s3Service.putObject(srtKey, fs.readFileSync(srtPath), 'text/plain');
    await s3Service.putObject(vttKey, fs.readFileSync(vttPath), 'text/vtt');
    
    // Save captions metadata to DynamoDB
    await ddbService.createCaptions({
      meetingId,
      srtKey,
      vttKey,
      segments
    });
    
    // Generate presigned URLs
    const srtUrl = await s3Service.getPresignedGetUrl(srtKey);
    const vttUrl = await s3Service.getPresignedGetUrl(vttKey);
    
    const responseData = {
      srtUrl,
      vttUrl,
      segments: segments.slice(0, 10) // Return first 10 segments for preview
    };

    // Store idempotency key if provided
    if (idempotencyKey) {
      await ddbService.storeIdempotencyKey(idempotencyKey, meetingId, 'transcribe', responseData);
    }

    res.json(responseData);
  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({ 
      error: 'Transcription failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    // Always clean up temp files
    if (tempDir) {
      await cleanupDir(tempDir);
    }
  }
});

/**
 * POST /v1/meetings/:id/actions
 * Extract action items from transcript
 * Supports idempotency via Idempotency-Key header
 */
router.post('/:id/actions', authRequired, requireGroup('Admin'), async (req, res) => {
  const meetingId = req.params.id;
  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

  try {
    // Check idempotency
    if (idempotencyKey) {
      const existing = await ddbService.checkIdempotencyKey(idempotencyKey);
      if (existing && existing.operation === 'actions' && existing.meetingId === meetingId) {
        console.log(`🔁 Returning cached result for idempotency key: ${idempotencyKey}`);
        return res.json(existing.result);
      }
    }

    const meeting = await ddbService.getMeeting(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    const captions = await ddbService.getCaptions(meetingId);
    if (!captions || !captions.segments) {
      return res.status(400).json({ error: 'Meeting must be transcribed first' });
    }
    
    const segments = captions.segments;
    let actionItems: any[] = [];
    
    if (await openaiService.isAvailable()) {
      // Use OpenAI action extraction
      actionItems = await openaiService.extractActions(segments);
    } else {
      // Use fallback rule-based extraction
      actionItems = fallbackService.extractActions(segments);
    }
    
    // Save actions to DynamoDB (idempotent - delete old actions first)
    const existingActions = await ddbService.getActions(meetingId);
    for (const action of existingActions) {
      await ddbService.deleteItem(action.sk);
    }
    
    for (const action of actionItems) {
      const actionId = uuidv4();
      await ddbService.createAction({
        meetingId,
        actionId,
        summary: action.summary,
        owner: action.owner || undefined,
        due_date: action.due_date || undefined,
        priority: action.priority || undefined,
        start: action.start || 0,
        end: action.end || 0,
        tags: action.tags || []
      });
    }
    
    const responseData = { actions: actionItems };

    // Store idempotency key if provided
    if (idempotencyKey) {
      await ddbService.storeIdempotencyKey(idempotencyKey, meetingId, 'actions', responseData);
    }

    res.json(responseData);
  } catch (error) {
    console.error('Action extraction error:', error);
    res.status(500).json({ 
      error: 'Action extraction failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;