import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const REGION = process.env.AWS_REGION || "ap-southeast-2";
const PARAM_NAME = process.env.API_BASE_URL_PARAM || "/wbr/api_base_url";

const ssmClient = new SSMClient({ region: REGION });

let cachedApiBaseUrl: string | null = null;

/**
 * Fetch API base URL from AWS Systems Manager Parameter Store with caching and fallback
 * @returns The API base URL from SSM, or fallback to process.env.API_BASE_URL or default
 */
export async function getApiBaseUrl(): Promise<string> {
  // Return cached value if available
  if (cachedApiBaseUrl) {
    console.log('🔑 Using cached API base URL');
    return cachedApiBaseUrl;
  }

  let lastErr: any;
  
  // Retry up to 3 times with exponential backoff
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`📡 Fetching API base URL from SSM Parameter Store (attempt ${attempt}/3)...`);
      
      const response = await ssmClient.send(
        new GetParameterCommand({
          Name: PARAM_NAME,
          WithDecryption: false // Not using SecureString, so no decryption needed
        })
      );

      const value = response.Parameter?.Value?.trim();
      
      if (value) {
        console.log('✅ API base URL fetched successfully from SSM Parameter Store');
        cachedApiBaseUrl = value;
        return value;
      }
      
      // Empty value - break to fallback
      console.warn('⚠️  SSM parameter exists but value is empty');
      break;
      
    } catch (error: any) {
      lastErr = error;
      console.error(`❌ Attempt ${attempt} failed:`, error.message);
      
      // Don't retry on certain errors
      if (error.name === 'ParameterNotFound') {
        console.error(`Parameter "${PARAM_NAME}" not found in SSM Parameter Store`);
        break;
      }
      
      // Exponential backoff: 200ms, 400ms, 600ms
      if (attempt < 3) {
        const backoffMs = 200 * attempt;
        console.log(`⏳ Retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }

  // Fallback to environment variable or default
  const fallback = process.env.API_BASE_URL || "http://localhost:8080";
  
  if (lastErr) {
    console.warn('[SSM] Using fallback API_BASE_URL:', fallback, '| error:', lastErr?.message);
  } else {
    console.log('[SSM] Using fallback API_BASE_URL:', fallback);
  }
  
  cachedApiBaseUrl = fallback;
  return cachedApiBaseUrl;
}

/**
 * Clear the cached API base URL (useful for testing or when parameter is updated)
 */
export function clearApiBaseUrlCache(): void {
  cachedApiBaseUrl = null;
  console.log('🗑️  API base URL cache cleared');
}

