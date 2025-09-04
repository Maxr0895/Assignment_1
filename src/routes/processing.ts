import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authRequired, requireRole } from '../middleware/auth';
import { dbHelpers } from '../services/db';
import { FFmpegService } from '../services/ffmpegService';
import { OpenAIService } from '../services/openaiService';
import { ActionsFallbackService } from '../services/actionsFallback';
import { config } from '../config';

const router = Router();
const ffmpegService = new FFmpegService();
const openaiService = new OpenAIService();
const fallbackService = new ActionsFallbackService();

// Scoped JSON parsing for this router (used by /transcribe)
router.use((req, res, next) => {
  (require('express') as typeof import('express')).json()(req, res, next);
});

router.post('/:id/transcode', authRequired, requireRole('editor'), async (req, res) => {
  try {
    const meetingId = req.params.id;
    
    const meeting = dbHelpers.getMeetingById(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    const meetingDir = path.join(config.dataDir, 'meetings', meetingId);
    const inputPath = path.join(meetingDir, 'input.mp4');
    
    if (!fs.existsSync(inputPath)) {
      return res.status(400).json({ error: 'Input video not found' });
    }
    
    dbHelpers.updateMeetingStatus(meetingId, 'transcoding');
    
    const result = await ffmpegService.transcodeVideo(inputPath, meetingDir);
    
    // Save renditions to database
    for (const rendition of result.renditions) {
      dbHelpers.insertRendition(
        rendition.id,
        meetingId,
        rendition.path,
        rendition.resolution,
        rendition.size_bytes
      );
    }
    
    // Update meeting duration
    dbHelpers.updateMeetingDuration(meetingId, result.duration_s);
    dbHelpers.updateMeetingStatus(meetingId, 'transcoded');
    
    res.json({
      renditions: result.renditions.map(r => ({
        path: `/files/meetings/${meetingId}/${path.basename(r.path)}`,
        resolution: r.resolution,
        size_bytes: r.size_bytes
      })),
      audioPath: `/files/meetings/${meetingId}/audio.mp3`,
      thumbnails: result.thumbnails.map(t => `/files/meetings/${meetingId}/${path.basename(t)}`),
      duration_s: result.duration_s
    });
  } catch (error) {
    console.error('Transcoding error:', error);
    dbHelpers.updateMeetingStatus(req.params.id, 'failed');
    res.status(500).json({ error: 'Transcoding failed' });
  }
});

router.post('/:id/transcribe', authRequired, requireRole('editor'), async (req, res) => {
  try {
    const meetingId = req.params.id;
    const { manualTranscript } = req.body;
    
    const meeting = dbHelpers.getMeetingById(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    const meetingDir = path.join(config.dataDir, 'meetings', meetingId);
    const audioPath = path.join(meetingDir, 'audio.mp3');
    
    let segments: any[] = [];
    
    if (openaiService.isAvailable() && fs.existsSync(audioPath)) {
      // Use OpenAI transcription
      segments = await openaiService.transcribeAudio(audioPath);
    } else if (manualTranscript) {
      // Use manual transcript
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
    
    const srtPath = path.join(meetingDir, 'captions.srt');
    const vttPath = path.join(meetingDir, 'captions.vtt');
    
    fs.writeFileSync(srtPath, captions.srt);
    fs.writeFileSync(vttPath, captions.vtt);
    
    // Save to database
    const captionId = uuidv4();
    dbHelpers.insertCaptions(
      captionId,
      meetingId,
      srtPath,
      vttPath,
      JSON.stringify(segments)
    );
    
    res.json({
      srtUrl: `/files/meetings/${meetingId}/captions.srt`,
      vttUrl: `/files/meetings/${meetingId}/captions.vtt`,
      segments: segments.slice(0, 10) // Return first 10 segments for preview
    });
  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: 'Transcription failed' });
  }
});

router.post('/:id/actions', authRequired, requireRole('editor'), async (req, res) => {
  try {
    const meetingId = req.params.id;
    
    const meeting = dbHelpers.getMeetingById(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    const captions = dbHelpers.getCaptionsByMeeting(meetingId);
    if (!captions || !captions.segments_json) {
      return res.status(400).json({ error: 'Meeting must be transcribed first' });
    }
    
    const segments = JSON.parse(captions.segments_json);
    let actionItems: any[] = [];
    
    if (openaiService.isAvailable()) {
      // Use OpenAI action extraction
      actionItems = await openaiService.extractActions(segments);
    } else {
      // Use fallback rule-based extraction
      actionItems = fallbackService.extractActions(segments);
    }
    
    // Save actions to database
    for (const action of actionItems) {
      const actionId = uuidv4();
      dbHelpers.insertAction(
        actionId,
        meetingId,
        action.summary,
        action.owner || '',
        action.owner || '',
        action.due_date || '',
        action.priority || '',
        action.start || 0,
        action.end || 0,
        openaiService.isAvailable() ? 'openai' : 'fallback'
      );
    }
    
    res.json({ actions: actionItems });
  } catch (error) {
    console.error('Action extraction error:', error);
    res.status(500).json({ error: 'Action extraction failed' });
  }
});

export default router;