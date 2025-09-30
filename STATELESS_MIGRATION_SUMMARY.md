# Stateless Migration Summary

## ✅ Changes Completed

Your application is now **fully stateless** and retry-safe!

### 1. Removed Session Dependencies

**Uninstalled:**
- `express-session`
- `@types/express-session`
- `openid-client`
- `jwks-rsa`
- `amazon-cognito-identity-js`

**Installed:**
- `aws-jwt-verify` - For stateless JWT verification

### 2. Updated Authentication Flow

**Old (Session-based):**
```
Login → Store in session → Check session on each request
```

**New (Stateless):**
```
Login → Receive accessToken → Send Bearer token on each request
```

**Frontend change:**
- Now stores `accessToken` instead of `idToken`
- Sends `Authorization: Bearer <accessToken>` on all API calls

**Backend change:**
- Uses `aws-jwt-verify` to validate Cognito access tokens
- No session storage
- Each request is independently authenticated

### 3. Temp File Management

**New utility:** `src/utils/temp.ts`
- `makeTempDir(prefix)` - Creates unique temp directories
- `cleanupDir(path)` - Recursively deletes directories

**Usage in processing routes:**
```typescript
let tempDir = await makeTempDir('transcode');
try {
  // Download from S3 → tempDir
  // Process with ffmpeg
  // Upload results to S3
} finally {
  await cleanupDir(tempDir); // Always cleanup
}
```

### 4. DynamoDB Status Tracking

**Meeting statuses:**
- `uploaded` - Initial state
- `processing` - Currently being processed
- `done` - Successfully completed
- `failed` - Error occurred

**Tracking fields:**
- `status` - Current processing state
- `lastUpdatedAt` - ISO timestamp of last update
- `error` - Error message (only on failed status)

### 5. Idempotency Support

**How to use:**
```bash
curl -X POST http://localhost:8080/v1/meetings/MEETING_ID/transcode \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: unique-operation-123"
```

**Benefits:**
- Retry-safe operations
- Cached results returned for duplicate requests
- 24-hour TTL on idempotency records

### 6. Updated Configuration

**Removed from `config.ts`:**
- `cognitoIssuer`
- `cognitoDomain`
- `cognitoRedirectUri`
- `cognitoLogoutUri`
- `sessionSecret`

**Kept:**
- `cognitoUserPoolId` (for JWT verification)
- `cognitoClientId` (for JWT verification)

### 7. Updated Routes

**Removed routes:**
- `GET /login` (browser redirect)
- `GET /callback` (OAuth callback)
- `GET /logout` (session logout)
- `GET /me` (session-based user info)

**Kept routes:**
- `POST /login` (returns JWT tokens)
- `POST /register` (user registration)
- `POST /confirm` (email confirmation)
- `POST /reset-password` (password reset)

### 8. Middleware Changes

**Old:** `ensureAuth` (supported sessions + bearer tokens)
**New:** `authRequired` (pure bearer token only)

```typescript
export async function authRequired(req, res, next) {
  // Extract Bearer token from Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.substring(7);
  
  // Verify using aws-jwt-verify
  const payload = await verifier.verify(token);
  req.user = payload;
  
  next();
}
```

## 🚀 How to Use

### 1. Login (Get Tokens)

```bash
curl -X POST http://localhost:8080/v1/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "Test1234!"
  }'
```

**Response:**
```json
{
  "success": true,
  "accessToken": "eyJraWQ...",
  "idToken": "eyJraWQ...",
  "expiresIn": 3600,
  "message": "Use accessToken in Authorization header as: Bearer <accessToken>"
}
```

### 2. Use Access Token

```bash
# Store token
TOKEN="eyJraWQ..."

# Upload meeting
curl -X POST http://localhost:8080/v1/meetings \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@video.mp4" \
  -F "title=Team Meeting"

# Process meeting
curl -X POST http://localhost:8080/v1/meetings/MEETING_ID/transcode \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Check Status

```bash
curl http://localhost:8080/v1/meetings/MEETING_ID \
  -H "Authorization: Bearer $TOKEN" | jq '.status'
```

## ✅ Acceptance Tests

### Test 1: Stateless Restart

1. Upload and start transcoding
2. Kill container: `docker rm -f wbr`
3. Restart container
4. Re-run transcode → Should complete successfully

### Test 2: Idempotency

1. Run transcode with `Idempotency-Key: test-123`
2. Run again with same key → Returns cached result immediately

### Test 3: No Local Storage

1. Check container has no persistent volumes
2. Verify all files are in S3
3. Verify all metadata is in DynamoDB

## 🔧 Environment Variables

**Update your `.env` file:**

Remove these (no longer needed):
```env
COGNITO_DOMAIN=
COGNITO_REDIRECT_URI=
COGNITO_LOGOUT_URI=
SESSION_SECRET=
```

Keep these (required):
```env
AWS_REGION=ap-southeast-2
S3_BUCKET=your-bucket
DDB_TABLE=your-table
QUT_USERNAME=n12345678@qut.edu.au
COGNITO_USER_POOL_ID=your-pool-id
COGNITO_CLIENT_ID=your-client-id
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_SESSION_TOKEN=...
```

## 📊 Files Modified

### Created:
- `src/utils/temp.ts` - Temp directory utilities

### Updated:
- `src/middleware/auth.ts` - Pure JWT verification
- `src/routes/auth.ts` - Removed browser flows, kept API auth
- `src/routes/processing.ts` - Added temp cleanup & idempotency
- `src/routes/meetings.ts` - Updated to use `authRequired`
- `src/routes/reports.ts` - Updated to use `authRequired`
- `src/services/ddb.ts` - Added status tracking & idempotency
- `src/server.ts` - Removed session middleware
- `src/config.ts` - Removed session-related config
- `public/app.js` - Use `accessToken` instead of `idToken`
- `env.example` - Updated with stateless config
- `README.md` - Full stateless deployment guide

### Deleted:
- `src/services/cognitoService.ts` - No longer needed

## 🎉 Benefits

1. **Zero Local State**: All data in S3/DynamoDB
2. **Horizontal Scaling**: Run multiple containers without issues
3. **Restart Safe**: Kill/restart containers anytime
4. **Retry Safe**: Idempotent operations
5. **No Sessions**: Pure stateless JWT auth
6. **Clean Temp Files**: Automatic cleanup after processing

## 🐛 Troubleshooting

### "Token verification failed: Token use not allowed: id"
→ Frontend is sending `idToken` instead of `accessToken`
→ Fixed in `public/app.js` line 201

### "Token has expired" (AWS)
→ AWS Academy credentials expired
→ Get fresh credentials from AWS Details

### "Invalid token issuer"
→ Check `COGNITO_USER_POOL_ID` is correct

### Processing fails but no cleanup
→ Temp files are auto-cleaned in `finally` blocks
→ Check logs for actual error
