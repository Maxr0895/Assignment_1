# AWS Secrets Manager Integration

This document summarizes the implementation of AWS Secrets Manager for secure OpenAI API key management.

## 📋 Overview

The OpenAI API key is now fetched from **AWS Secrets Manager** instead of directly from environment variables. This provides:

- ✅ **Better Security**: Keys not stored in environment variables or code
- ✅ **Credential Rotation**: Easy to rotate keys without redeploying
- ✅ **Caching**: In-memory cache (5 min TTL) to avoid repeated API calls
- ✅ **Retry Logic**: 3 retries with exponential backoff
- ✅ **Local Dev Fallback**: Falls back to `OPENAI_API_KEY` env var if Secrets Manager unavailable

## 🔧 Implementation Details

### New Files Created

#### `src/services/secrets.ts`
- `getOpenAIKey()`: Fetches OpenAI key from Secrets Manager with caching
- `fetchSecretWithRetry()`: Handles retry logic with exponential backoff
- `clearSecretCache()`: Utility to clear cache (for testing/rotation)
- Supports both plain text and JSON secret formats
- Falls back to `process.env.OPENAI_API_KEY` in local development

### Modified Files

#### `src/services/openaiService.ts`
- Changed from synchronous to **lazy async initialization**
- Added `initialize()` method that fetches key from Secrets Manager
- Made `isAvailable()` async (now returns `Promise<boolean>`)
- All methods now call `initialize()` before using the OpenAI client

#### `src/routes/processing.ts`
- Updated `openaiService.isAvailable()` calls to use `await`
- Line 215: Transcription availability check
- Line 342: Action extraction availability check

#### `env.example`
- Added `OPENAI_SECRET_NAME=a2-n8501645`
- Updated `OPENAI_API_KEY` description to indicate it's a fallback

#### `README.md`
- Added comprehensive section: "🔐 AWS Secrets Manager for OpenAI API Key"
- Setup instructions for creating the secret
- IAM permissions required
- How the caching and retry logic works
- Verification and troubleshooting

## 🚀 Usage

### 1. Create the Secret in AWS Secrets Manager

**Option 1: Plain Text (Recommended)**
```
Secret name: a2-n8501645
Region: ap-southeast-2
Value: sk-proj-...your-openai-api-key...
```

**Option 2: JSON**
```json
{
  "OPENAI_API_KEY": "sk-proj-...your-openai-api-key..."
}
```

### 2. Update IAM Permissions

Add to your EC2 instance role or user policy:
```json
{
  "Effect": "Allow",
  "Action": ["secretsmanager:GetSecretValue"],
  "Resource": "arn:aws:secretsmanager:ap-southeast-2:*:secret:a2-n8501645-*"
}
```

### 3. Update Environment Variables

Add to your `.env`:
```env
# Production: Secret name in AWS Secrets Manager
OPENAI_SECRET_NAME=a2-n8501645

# Local dev: Fallback API key (optional)
OPENAI_API_KEY=sk-proj-...
```

### 4. Restart Your Application

```bash
npm run dev
```

## 🔍 How It Works

1. **First API call** triggers `openaiService.initialize()`
2. `getOpenAIKey()` is called from `src/services/secrets.ts`
3. Check in-memory cache (5 min TTL)
4. If not cached, fetch from Secrets Manager with retry logic:
   - Attempt 1: Immediate
   - Attempt 2: Wait 1s (2^0 * 1000ms)
   - Attempt 3: Wait 2s (2^1 * 1000ms)
   - Attempt 4: Wait 4s (2^2 * 1000ms)
5. If all retries fail or secret not found:
   - Fall back to `process.env.OPENAI_API_KEY`
   - Log warning
6. Cache the key in memory for 5 minutes
7. Initialize OpenAI client with the key

## 📊 Expected Logs

### Success (Secrets Manager)
```
📡 Fetching secret from Secrets Manager (attempt 1/3)...
✅ Secret fetched successfully from Secrets Manager
✅ OpenAI client initialized
```

### Fallback (Local Dev)
```
📡 Fetching secret from Secrets Manager (attempt 1/3)...
❌ Attempt 1 failed: ResourceNotFoundException: Secret "a2-n8501645" not found
⏳ Retrying in 1000ms...
...
⚠️  Failed to fetch OpenAI key from Secrets Manager: ResourceNotFoundException
🔄 Falling back to OPENAI_API_KEY from environment variables
✅ OpenAI client initialized
```

### Cached
```
🔑 Using cached OpenAI key
✅ OpenAI client initialized
```

## 🧪 Testing

### Test with Secrets Manager
1. Create secret in AWS Secrets Manager
2. Ensure IAM permissions are set
3. Remove `OPENAI_API_KEY` from `.env`
4. Restart server
5. Try transcription - should fetch from Secrets Manager

### Test Fallback
1. Don't create secret (or use wrong name)
2. Set `OPENAI_API_KEY` in `.env`
3. Restart server
4. Try transcription - should fall back to env var

### Test Caching
1. Make first API call (fetches from Secrets Manager)
2. Make second API call within 5 minutes (uses cache)
3. Check logs for "🔑 Using cached OpenAI key"

## 🔒 Security Benefits

1. **No Hardcoded Secrets**: API key never in code or version control
2. **Rotation Ready**: Update secret in AWS without redeploying
3. **Audit Trail**: AWS CloudTrail logs all secret access
4. **Least Privilege**: IAM permissions control who/what can access
5. **Encrypted at Rest**: Secrets Manager encrypts with AWS KMS

## 🎯 Assignment Compliance

This implementation satisfies the requirement for **secure credential management** in cloud deployments:

- ✅ Production secrets stored in AWS Secrets Manager (not environment variables)
- ✅ Automatic retry with exponential backoff
- ✅ In-memory caching to reduce API calls
- ✅ Graceful fallback for local development
- ✅ Comprehensive error handling and logging

## 📦 Dependencies

Added:
- `@aws-sdk/client-secrets-manager` (v3.x)

No breaking changes to existing functionality.

