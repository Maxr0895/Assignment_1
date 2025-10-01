# AWS SSM Parameter Store Implementation

This document summarizes the implementation of AWS Systems Manager Parameter Store for dynamic API base URL configuration.

## 📋 Overview

The API base URL is now fetched from **AWS SSM Parameter Store** instead of being hardcoded. This provides:

- ✅ **Dynamic Configuration**: Change the URL without redeploying
- ✅ **Environment Flexibility**: Different URLs per environment (dev/staging/prod)
- ✅ **Caching**: In-memory cache for performance
- ✅ **Retry Logic**: 3 retries with exponential backoff
- ✅ **Local Dev Fallback**: Falls back to `API_BASE_URL` env var if SSM unavailable

## 🔧 Implementation Details

### New Files Created

#### `src/services/ssm.ts`
- `getApiBaseUrl()`: Fetches API base URL from SSM with caching and retry logic
- `clearApiBaseUrlCache()`: Utility to clear cache (for testing/updates)
- Supports both SSM Parameter Store and fallback to `process.env.API_BASE_URL`
- Default parameter name: `/wbr/api_base_url`
- Default fallback: `http://localhost:8080`

#### `src/routes/config.ts`
- `GET /v1/config`: Public endpoint that returns `{ apiBaseUrl }` for frontend consumption
- No authentication required (public configuration)
- Error handling with detailed logging

### Modified Files

#### `src/server.ts`
- Added import for `configRouter` and `getApiBaseUrl`
- Mounted `configRouter` for `/v1/config` endpoint
- Added **prewarming** on server startup:
  - Fetches API base URL before first request
  - Logs the value: `API base URL: <value>`
  - Catches and logs errors gracefully

#### `env.example`
- Added `API_BASE_URL_PARAM=/wbr/api_base_url` (parameter name)
- Added `API_BASE_URL=http://localhost:8080` (fallback for local dev)

#### `README.md`
- Added comprehensive section: "🔧 AWS Systems Manager Parameter Store for API Base URL"
- Setup instructions for creating the parameter
- IAM permissions required (`ssm:GetParameter`)
- How the caching and retry logic works
- Frontend usage example
- Verification and troubleshooting

#### `package.json`
- Added dependency: `@aws-sdk/client-ssm`

## 🚀 Usage

### 1. Create the Parameter in AWS SSM

**Via AWS Console:**
1. Go to AWS Systems Manager → Parameter Store
2. Click "Create parameter"
3. **Name**: `/wbr/api_base_url`
4. **Type**: `String`
5. **Value**: `http://localhost:8080` (or your actual URL)
6. Click "Create parameter"

**Via AWS CLI:**
```bash
aws ssm put-parameter \
  --name "/wbr/api_base_url" \
  --value "http://localhost:8080" \
  --type "String" \
  --region ap-southeast-2
```

### 2. Update IAM Permissions

Add to your EC2 instance role or user policy:
```json
{
  "Effect": "Allow",
  "Action": ["ssm:GetParameter"],
  "Resource": "arn:aws:ssm:ap-southeast-2:*:parameter/wbr/api_base_url"
}
```

### 3. Update Environment Variables (Optional)

Add to your `.env`:
```env
# SSM Parameter name (default: /wbr/api_base_url)
API_BASE_URL_PARAM=/wbr/api_base_url

# Fallback for local development (optional)
API_BASE_URL=http://localhost:8080
```

### 4. Start the Server

```bash
npm run dev
```

**Expected logs:**
```
WBR Actionizer server running on port 8080
...
📡 Fetching API base URL from SSM Parameter Store (attempt 1/3)...
✅ API base URL fetched successfully from SSM Parameter Store
API base URL: http://localhost:8080
```

### 5. Test the Endpoint

```bash
curl http://localhost:8080/v1/config
```

**Response:**
```json
{
  "apiBaseUrl": "http://localhost:8080"
}
```

## 🔍 How It Works

### Server Startup Flow

1. Server starts and mounts routes
2. **Prewarming** begins (async in `app.listen` callback)
3. `getApiBaseUrl()` is called
4. Checks in-memory cache (empty on first run)
5. Attempts to fetch from SSM (retry up to 3 times)
6. On success: caches value and returns it
7. On failure: falls back to `process.env.API_BASE_URL` or `http://localhost:8080`
8. Logs final value: `API base URL: <value>`

### Runtime Request Flow

1. Frontend calls `GET /v1/config`
2. `getApiBaseUrl()` is called
3. Returns cached value (already fetched during startup)
4. Response: `{ "apiBaseUrl": "..." }`

### Retry Logic

- **Attempt 1**: Immediate
- **Attempt 2**: Wait 200ms (200 * 1)
- **Attempt 3**: Wait 400ms (200 * 2)
- **Fallback**: Use `process.env.API_BASE_URL` or `http://localhost:8080`

### Error Handling

- **ParameterNotFound**: Immediately fall back (no retries)
- **AccessDenied**: Immediately fall back (no retries)
- **Throttling/Network**: Retry with backoff
- **Empty value**: Fall back to default

## 📊 Expected Logs

### Success (SSM Parameter Store)
```
📡 Fetching API base URL from SSM Parameter Store (attempt 1/3)...
✅ API base URL fetched successfully from SSM Parameter Store
API base URL: https://api.example.com
```

### Fallback (Local Dev)
```
📡 Fetching API base URL from SSM Parameter Store (attempt 1/3)...
❌ Attempt 1 failed: ParameterNotFound
Parameter "/wbr/api_base_url" not found in SSM Parameter Store
[SSM] Using fallback API_BASE_URL: http://localhost:8080
API base URL: http://localhost:8080
```

### Cached (Subsequent Calls)
```
🔑 Using cached API base URL
```

## 🧪 Testing

### Test with SSM Parameter Store
1. Create parameter in AWS SSM
2. Ensure IAM permissions are set
3. Remove `API_BASE_URL` from `.env` (optional)
4. Restart server
5. Check logs for SSM fetch success
6. Call `GET /v1/config` - should return SSM value

### Test Fallback
1. Don't create parameter (or use wrong name)
2. Set `API_BASE_URL=http://localhost:3000` in `.env`
3. Restart server
4. Check logs for fallback message
5. Call `GET /v1/config` - should return `http://localhost:3000`

### Test Caching
1. Start server (fetches from SSM)
2. Change parameter value in AWS SSM
3. Call `GET /v1/config` - returns **cached** (old) value
4. Restart server - fetches new value

### Test Frontend Integration
```javascript
// In your frontend code
async function getConfig() {
  const response = await fetch('/v1/config');
  const { apiBaseUrl } = await response.json();
  console.log('API Base URL:', apiBaseUrl);
  
  // Use it for API calls
  const data = await fetch(`${apiBaseUrl}/v1/meetings`);
}
```

## 🎯 Assignment Compliance

This implementation satisfies requirements for **dynamic configuration management**:

- ✅ Configuration stored in AWS Systems Manager (not hardcoded)
- ✅ Automatic retry with exponential backoff
- ✅ In-memory caching to reduce API calls
- ✅ Graceful fallback for local development
- ✅ Comprehensive error handling and logging
- ✅ Public endpoint for frontend consumption
- ✅ Zero breaking changes to existing functionality

## 📦 Dependencies

Added:
- `@aws-sdk/client-ssm` (v3.x)

No breaking changes to existing functionality.

## 🔒 Security Benefits

1. **No Hardcoded URLs**: Configuration externalized to AWS SSM
2. **Environment-Specific**: Different values per deployment environment
3. **Audit Trail**: AWS CloudTrail logs all parameter access
4. **Least Privilege**: IAM permissions control who/what can read
5. **Easy Rotation**: Update parameter without redeploying code

