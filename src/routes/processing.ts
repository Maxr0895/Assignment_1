import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authRequired, requireGroup } from '../middleware/auth';
import { s3Service } from '../services/s3';
import { ddbService } from '../services/ddb';
import { getSQSService } from '../services/sqs';
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
 * Queue a transcode job via SQS (async processing)
 * Returns immediately with 202 Accepted
 */
// Note: MFA enforcement removed due to USER_PASSWORD_AUTH flow limitation (doesn't include amr claim)
// MFA is still enforced at enrollment and frontend UI level
router.post('/:id/transcode', authRequired, requireGroup('Admin'), async (req, res) => {
  const meetingId = req.params.id;
  const userId = req.user!.sub;
  
  try {
    // Get meeting from DynamoDB
    const meeting = await ddbService.getMeeting(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Check if already processing or done
    if (meeting.status === 'processing') {
      return res.status(409).json({ 
        error: 'Transcode already in progress',
        status: meeting.status
      });
    }

    if (meeting.status === 'done' && meeting.duration_s) {
      return res.status(409).json({ 
        error: 'Meeting already transcoded',
        status: meeting.status
      });
    }
    
    // Update status to queued
    await ddbService.updateMeeting(meetingId, { status: 'queued' });
    
    // Publish job to SQS
    const sqsService = getSQSService();
    const messageId = await sqsService.publishTranscodeJob({
      meetingId,
      userId,
      requestedAt: new Date().toISOString()
    });

    console.log(`✅ Transcode job queued for meeting ${meetingId} (SQS MessageId: ${messageId})`);

    // Return 202 Accepted immediately
    res.status(202).json({
      message: 'Transcode job queued successfully',
      meetingId,
      status: 'queued',
      queueMessageId: messageId
    });
  } catch (error) {
    console.error('Failed to queue transcode job:', error);
    
    // Update status to failed with error message
    await ddbService.updateMeeting(meetingId, { 
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({ 
      error: 'Failed to queue transcode job',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
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
    await new Promise<void>((resolve, reject) => {
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
    if (tempDir) {
      cleanupDir(tempDir).catch(() => undefined);
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