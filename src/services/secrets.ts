import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { config } from '../config';

// In-memory cache for secrets
let cachedOpenAIKey: string | null = null;
let cacheTimestamp: number | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Initialize Secrets Manager client
const secretsClient = new SecretsManagerClient({
  region: config.awsRegion
});

/**
 * Fetch secret from AWS Secrets Manager with retry logic and exponential backoff
 */
async function fetchSecretWithRetry(secretName: string, maxRetries = 3): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📡 Fetching secret from Secrets Manager (attempt ${attempt}/${maxRetries})...`);
      
      const command = new GetSecretValueCommand({
        SecretId: secretName
      });

      const response = await secretsClient.send(command);

      if (response.SecretString) {
        console.log('✅ Secret fetched successfully from Secrets Manager');
        return response.SecretString;
      } else {
        throw new Error('Secret value is empty');
      }
    } catch (error: any) {
      lastError = error;
      console.error(`❌ Attempt ${attempt} failed:`, error.message);

      // Don't retry on certain errors
      if (error.name === 'ResourceNotFoundException') {
        console.error(`Secret "${secretName}" not found in Secrets Manager`);
        break;
      }

      // Exponential backoff: 1s, 2s, 4s
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt - 1) * 1000;
        console.log(`⏳ Retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw lastError || new Error('Failed to fetch secret after retries');
}

/**
 * Get OpenAI API key from AWS Secrets Manager with caching
 * Falls back to process.env.OPENAI_API_KEY in local development
 */
export async function getOpenAIKey(): Promise<string | undefined> {
  const secretName = process.env.OPENAI_SECRET_NAME || 'a2-n8501645';
  const localFallback = process.env.OPENAI_API_KEY;

  // Check cache first (with TTL)
  const now = Date.now();
  if (cachedOpenAIKey && cacheTimestamp && (now - cacheTimestamp) < CACHE_TTL_MS) {
    console.log('🔑 Using cached OpenAI key');
    return cachedOpenAIKey;
  }

  try {
    // Try to fetch from Secrets Manager
    const secretValue = await fetchSecretWithRetry(secretName);
    
    // Parse the secret (it might be JSON or plain text)
    let apiKey: string;
    try {
      const parsed = JSON.parse(secretValue);
      // If it's JSON, look for common key names (case-insensitive check)
      apiKey = parsed.OPENAI_API_KEY || parsed.OPENai_API_KEY || parsed.apiKey || parsed.key || secretValue;
    } catch {
      // If not JSON, use the value directly
      apiKey = secretValue;
    }

    // Cache the key
    cachedOpenAIKey = apiKey;
    cacheTimestamp = now;

    return apiKey;
  } catch (error: any) {
    console.error('⚠️  Failed to fetch OpenAI key from Secrets Manager:', error.message);

    // Fallback to environment variable in local development
    if (localFallback) {
      console.log('🔄 Falling back to OPENAI_API_KEY from environment variables');
      return localFallback;
    }

    console.error('❌ No OpenAI API key available (Secrets Manager failed and no local fallback)');
    return undefined;
  }
}

/**
 * Clear the cached secret (useful for testing or when credentials are rotated)
 */
export function clearSecretCache(): void {
  cachedOpenAIKey = null;
  cacheTimestamp = null;
  console.log('🗑️  Secret cache cleared');
}

