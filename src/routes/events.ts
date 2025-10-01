import { Router, Request, Response } from 'express';
import { authRequired } from '../middleware/auth';
import { ddbService } from '../services/ddb';

const router = Router();

/**
 * GET /v1/meetings/:id/events
 * Server-Sent Events endpoint for real-time meeting status updates
 * 
 * Fully stateless: does NOT hold meeting state in memory,
 * only polls DynamoDB periodically and sends events to client
 * 
 * Graceful reconnection: client can disconnect/reconnect without losing state
 */
router.get('/:id/events', authRequired, async (req: Request, res: Response) => {
  const meetingId = req.params.id;
  
  console.log(`📡 SSE connection opened for meeting ${meetingId} by user ${req.user?.username}`);
  
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  
  // Send initial connection event
  res.write(`event: connected\n`);
  res.write(`data: ${JSON.stringify({ meetingId, timestamp: new Date().toISOString() })}\n\n`);
  
  // Polling interval: check DynamoDB every 3 seconds
  const statusInterval = setInterval(async () => {
    try {
      // Fetch fresh state from DynamoDB (stateless - no memory storage)
      const meeting = await ddbService.getMeeting(meetingId);
      
      if (!meeting) {
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ error: 'Meeting not found' })}\n\n`);
        clearInterval(statusInterval);
        clearInterval(keepaliveInterval);
        res.end();
        return;
      }
      
      // Send meeting status update
      res.write(`event: status\n`);
      res.write(`data: ${JSON.stringify({
        meetingId,
        status: meeting.status,
        title: meeting.title,
        duration_s: meeting.duration_s,
        lastUpdatedAt: meeting.lastUpdatedAt,
        hasRenditions: meeting.renditions && meeting.renditions.length > 0,
        hasCaptions: !!meeting.captions,
        hasActions: meeting.actions && meeting.actions.length > 0,
        timestamp: new Date().toISOString()
      })}\n\n`);
      
    } catch (error: any) {
      console.error(`❌ SSE polling error for meeting ${meetingId}:`, error.message);
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ error: 'Failed to fetch meeting status' })}\n\n`);
    }
  }, 3000); // Poll every 3 seconds
  
  // Keepalive ping: send every 15 seconds to prevent connection timeout
  const keepaliveInterval = setInterval(() => {
    res.write(`: ping\n\n`);
  }, 15000);
  
  // Graceful cleanup on disconnect
  req.on('close', () => {
    console.log(`📡 SSE connection closed for meeting ${meetingId}`);
    clearInterval(statusInterval);
    clearInterval(keepaliveInterval);
    
    // Send final event before closing (best effort - may not reach client)
    try {
      res.write(`event: connectionLost\n`);
      res.write(`data: ${JSON.stringify({ meetingId, timestamp: new Date().toISOString() })}\n\n`);
    } catch (e) {
      // Connection already closed, ignore
    }
    
    res.end();
  });
});

export default router;

