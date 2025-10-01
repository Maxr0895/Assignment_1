import { Router } from 'express';
import { getApiBaseUrl } from '../services/ssm';

export const configRouter = Router();

/**
 * GET /v1/config
 * Returns configuration values for the frontend
 * No authentication required - this is public config
 */
configRouter.get('/v1/config', async (_req, res) => {
  try {
    const apiBaseUrl = await getApiBaseUrl();
    
    res.json({ 
      apiBaseUrl 
    });
  } catch (error: any) {
    console.error('Config endpoint error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch configuration',
      details: error.message 
    });
  }
});

