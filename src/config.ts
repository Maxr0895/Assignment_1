import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root (one level up from src/)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

interface Config {
  port: number;
  jwtSecret: string;
  openaiApiKey?: string;
  dataDir: string;
  // AWS configuration
  awsRegion: string;
  s3Bucket: string;
  ddbTable: string;
  qutUsername: string;
  sqsQueueUrl: string;
  // Cognito configuration
  cognitoUserPoolId: string;
  cognitoClientId: string;
}

function loadConfig(): Config {
  const port = parseInt(process.env.PORT || '8080');
  const jwtSecret = process.env.JWT_SECRET;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  // AWS configuration
  const awsRegion = process.env.AWS_REGION;
  const s3Bucket = process.env.S3_BUCKET;
  const ddbTable = process.env.DDB_TABLE;
  const qutUsername = process.env.QUT_USERNAME;
  const sqsQueueUrl = process.env.SQS_QUEUE_URL;
  
  // Cognito configuration
  const cognitoUserPoolId = process.env.COGNITO_USER_POOL_ID;
  const cognitoClientId = process.env.COGNITO_CLIENT_ID;
  
  // Validate required variables
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  
  if (!port || isNaN(port)) {
    throw new Error('Valid PORT environment variable is required');
  }

  if (!awsRegion) {
    throw new Error('AWS_REGION environment variable is required (e.g., ap-southeast-2)');
  }

  if (!s3Bucket) {
    throw new Error('S3_BUCKET environment variable is required');
  }

  if (!ddbTable) {
    throw new Error('DDB_TABLE environment variable is required');
  }

  if (!qutUsername) {
    throw new Error('QUT_USERNAME environment variable is required (format: username@qut.edu.au)');
  }

  // Validate QUT_USERNAME format
  if (!qutUsername.endsWith('@qut.edu.au')) {
    throw new Error('QUT_USERNAME must be a valid QUT email (e.g., n12345678@qut.edu.au)');
  }

  if (!cognitoUserPoolId) {
    throw new Error('COGNITO_USER_POOL_ID environment variable is required');
  }

  if (!cognitoClientId) {
    throw new Error('COGNITO_CLIENT_ID environment variable is required');
  }

  if (!sqsQueueUrl) {
    throw new Error('SQS_QUEUE_URL environment variable is required');
  }

  // Allow override via DATA_DIR; default to project-local ./data to be Windows-friendly
  // Note: For stateless operation, this will only be used for temp files
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');

  return {
    port,
    jwtSecret,
    openaiApiKey: openaiApiKey || undefined,
    dataDir,
    awsRegion,
    s3Bucket,
    ddbTable,
    qutUsername,
    sqsQueueUrl,
    cognitoUserPoolId,
    cognitoClientId
  };
}

export const config = loadConfig();