import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config';
import { initializeDatabase } from './services/db';
import authRoutes from './routes/auth';
import meetingsRoutes from './routes/meetings';
import processingRoutes from './routes/processing';
import reportsRoutes from './routes/reports';

const app = express();

// Initialize database
initializeDatabase();

// Middleware
app.use(cors());
// Note: JSON parsing is applied within individual routers to avoid conflicts with multipart uploads

// Serve static files from public directory
app.use(express.static('public'));

// Serve uploaded files
app.use('/files', express.static(config.dataDir));

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ 
    ok: true, 
    uptime: process.uptime(),
    openaiAvailable: !!config.openaiApiKey
  });
});

// API routes
app.use('/v1', authRoutes);
app.use('/v1/meetings', meetingsRoutes);
app.use('/v1/meetings', processingRoutes);
app.use('/v1/reports', reportsRoutes);

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

const server = app.listen(config.port, () => {
  console.log(`WBR Actionizer server running on port ${config.port}`);
  console.log(`OpenAI integration: ${config.openaiApiKey ? 'enabled' : 'disabled'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});