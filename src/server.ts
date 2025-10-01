import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config';
import authRoutes from './routes/auth';
import meetingsRoutes from './routes/meetings';
import processingRoutes from './routes/processing';
import reportsRoutes from './routes/reports';
import filesRoutes from './routes/files';
import eventsRoutes from './routes/events';
import { configRouter } from './routes/config';
import { openaiService } from './services/openaiService';
import { getApiBaseUrl } from './services/ssm';

const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));

// Note: JSON parsing is applied within individual routers to avoid conflicts with multipart uploads

// Serve static files from public directory
app.use(express.static('public'));

// Health check (no auth required)
app.get('/health', async (req, res) => {
  const openaiAvailable = await openaiService.isAvailable();
  
  res.json({ 
    ok: true, 
    uptime: process.uptime(),
    openaiAvailable,
    stateless: true
  });
});

// API routes
app.use('/v1', authRoutes);
app.use('/v1/meetings', meetingsRoutes);
app.use('/v1/meetings', processingRoutes);
app.use('/v1/meetings', eventsRoutes); // SSE for real-time updates
app.use('/v1/reports', reportsRoutes);
app.use('/v1/files', filesRoutes);
app.use(configRouter); // Public config endpoint

// Catch all handler
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Multer file size error
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    const maxMB = parseInt(process.env.UPLOAD_MAX_MB || '300');
    return res.status(413).json({ error: `File too large (max ${maxMB}MB)` });
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(config.port, async () => {
  console.log(`WBR Actionizer server running on port ${config.port}`);
  
  // OpenAI status message
  const secretName = process.env.OPENAI_SECRET_NAME || 'a2-n8501645';
  const hasFallback = !!config.openaiApiKey;
  
  if (hasFallback) {
    console.log(`OpenAI: Will try Secrets Manager "${secretName}", fallback to env var ✅`);
  } else {
    console.log(`OpenAI: Will fetch from Secrets Manager "${secretName}" (no fallback)`);
  }
  
  console.log(`Stateless mode: ✅ (no sessions, pure JWT auth)`);
  
  // Prewarm API base URL from SSM Parameter Store
  try {
    const apiBaseUrl = await getApiBaseUrl();
    console.log(`API base URL: ${apiBaseUrl}`);
  } catch (error: any) {
    console.error('Failed to prewarm API base URL:', error.message);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});