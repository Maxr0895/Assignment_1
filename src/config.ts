import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

interface Config {
  port: number;
  jwtSecret: string;
  openaiApiKey?: string;
  dataDir: string;
}

function loadConfig(): Config {
  const port = parseInt(process.env.PORT || '8080');
  const jwtSecret = process.env.JWT_SECRET;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  
  if (!port || isNaN(port)) {
    throw new Error('Valid PORT environment variable is required');
  }

  // Allow override via DATA_DIR; default to project-local ./data to be Windows-friendly
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');

  return {
    port,
    jwtSecret,
    openaiApiKey: openaiApiKey || undefined,
    dataDir
  };
}

export const config = loadConfig();