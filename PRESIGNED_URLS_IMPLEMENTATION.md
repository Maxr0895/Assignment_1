# Pre-signed URLs Implementation Summary

## ✅ Implementation Complete

Your Node.js/Express app now supports S3 pre-signed URLs for direct client-to-S3 file upload and download operations.

## 📁 Files Created/Modified

### Created Files:
1. **`src/routes/files.ts`** - New route handlers for presigned URL endpoints
2. **`PRESIGNED_URLS_GUIDE.md`** - Comprehensive usage documentation
3. **`public/presigned-upload-test.html`** - Interactive test page

### Modified Files:
1. **`src/services/s3.ts`** - Added `getPresignedPutUrl()` method
2. **`src/server.ts`** - Registered new `/v1/files` routes

## 🚀 New API Endpoints

### 1. POST `/v1/files/presign-upload`
- **Purpose:** Generate pre-signed URL for uploading files directly to S3
- **Auth:** Required (Bearer token)
- **Request Body:**
  ```json
  {
    "fileName": "video.mp4",
    "fileType": "video/mp4"
  }
  ```
- **Response:**
  ```json
  {
    "uploadUrl": "https://s3.amazonaws.com/...",
    "key": "meetings/uuid/video.mp4",
    "meetingId": "uuid",
    "expiresIn": 900
  }
  ```
- **URL Expiration:** 15 minutes (900 seconds)

### 2. GET `/v1/files/presign-download/:key`
- **Purpose:** Generate pre-signed URL for downloading files from S3
- **Auth:** Required (Bearer token)
- **Path Parameter:** S3 object key (URL-encoded)
- **Response:**
  ```json
  {
    "downloadUrl": "https://s3.amazonaws.com/...",
    "key": "meetings/uuid/video.mp4",
    "expiresIn": 900
  }
  ```
- **URL Expiration:** 15 minutes (900 seconds)

## 🔧 S3 Service Updates

Added new method to `src/services/s3.ts`:

```typescript
async getPresignedPutUrl(
  key: string, 
  contentType: string, 
  expiresInSeconds = 900
): Promise<string>
```

This generates a PUT pre-signed URL that:
- Allows direct client-to-S3 uploads
- Enforces the specified content type
- Expires after 15 minutes by default

## 📊 S3 Storage Structure

Files uploaded via pre-signed URLs follow this pattern:
```
s3://your-bucket/
  └── meetings/
      └── {uuid}/
          └── {fileName}
```

Example:
```
s3://a2-n8501645/meetings/550e8400-e29b-41d4-a716-446655440000/meeting-video.mp4
```

## 💻 Client-Side Usage

### Basic Upload Example

```javascript
// 1. Get presigned URL
const response = await fetch('/v1/files/presign-upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    fileName: file.name,
    fileType: file.type
  })
});

const { uploadUrl, key } = await response.json();

// 2. Upload directly to S3
await fetch(uploadUrl, {
  method: 'PUT',
  headers: {
    'Content-Type': file.type
  },
  body: file
});
```

### Basic Download Example

```javascript
// 1. Get presigned download URL
const response = await fetch(`/v1/files/presign-download/${encodeURIComponent(s3Key)}`, {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const { downloadUrl } = await response.json();

// 2. Download from S3
window.location.href = downloadUrl; // Or use fetch() for programmatic download
```

## 🧪 Testing

### Option 1: Interactive Test Page
Visit: `http://localhost:8080/presigned-upload-test.html`

1. Login with your credentials
2. Select a file to upload
3. Watch the progress bar
4. Get download URL for the uploaded file

### Option 2: cURL Commands

**Get Upload URL:**
```bash
curl -X POST http://localhost:8080/v1/files/presign-upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fileName":"test.mp4","fileType":"video/mp4"}'
```

**Upload to S3:**
```bash
curl -X PUT "PRESIGNED_UPLOAD_URL" \
  -H "Content-Type: video/mp4" \
  --data-binary @test.mp4
```

**Get Download URL:**
```bash
curl http://localhost:8080/v1/files/presign-download/meetings/uuid/test.mp4 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🔒 Security Features

1. **Authentication:** All endpoints require valid Bearer token
2. **Expiration:** URLs expire after 15 minutes
3. **Content-Type Enforcement:** Upload URLs enforce the specified content type
4. **Bucket Isolation:** Uses configured S3 bucket from environment
5. **No Server Processing:** Files bypass the application server entirely

## ✅ Benefits

1. **Performance:** Direct S3 uploads reduce server load
2. **Scalability:** Server doesn't handle large file transfers
3. **Bandwidth:** Saves application server bandwidth
4. **Progress Tracking:** Client can track upload progress
5. **Large Files:** No server-side size limits (only S3 limits apply)

## 🔗 Integration with Existing Features

This implementation is **completely additive** and doesn't break existing functionality:

### Old Flow (Still Works):
```
Client → POST /v1/meetings → Server → S3
```

### New Flow (Optional):
```
Client → POST /v1/files/presign-upload → Get URL
Client → PUT to S3 URL → Direct S3 Upload
```

**Use Cases:**
- **Old flow:** Small files, need immediate server processing
- **New flow:** Large files, better performance, progress tracking

## 📝 Environment Configuration

The implementation uses the existing `S3_BUCKET` environment variable:

```env
S3_BUCKET=a2-n8501645
AWS_REGION=ap-southeast-2
```

No additional configuration needed!

## 🚀 Deployment

The new endpoints are ready to deploy:

1. **Commit changes:**
   ```bash
   git add -A
   git commit -m "Add presigned URL support for direct S3 uploads/downloads"
   git push
   ```

2. **Deploy to EC2:**
   ```bash
   # Pull latest code
   git pull
   
   # Install dependencies (if needed)
   npm install
   
   # Restart server
   pm2 restart all
   ```

3. **Test deployment:**
   ```bash
   curl http://your-ec2-url/health
   ```

## 📚 Documentation

See `PRESIGNED_URLS_GUIDE.md` for:
- Detailed API documentation
- More client-side examples
- React/TypeScript examples
- Security best practices
- Troubleshooting guide

## ✨ Next Steps

You can now:
1. Test the interactive upload page at `/presigned-upload-test.html`
2. Integrate presigned URLs into your frontend
3. Use for large file uploads to improve performance
4. Deploy to EC2 alongside existing features

