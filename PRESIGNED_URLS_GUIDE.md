# Pre-signed URLs for Direct S3 Upload/Download

This guide shows how to use the pre-signed URL endpoints for direct client-to-S3 file operations.

## 🎯 Overview

The app now supports generating pre-signed URLs that allow clients to upload and download files directly to/from S3 without going through the application server. This reduces server load and improves performance for large file operations.

## 📡 API Endpoints

### 1. Generate Upload URL

**Endpoint:** `POST /v1/files/presign-upload`

**Request:**
```json
{
  "fileName": "meeting-video.mp4",
  "fileType": "video/mp4"
}
```

**Response:**
```json
{
  "uploadUrl": "https://s3.amazonaws.com/bucket-name/meetings/uuid/meeting-video.mp4?X-Amz-...",
  "key": "meetings/uuid/meeting-video.mp4",
  "meetingId": "550e8400-e29b-41d4-a716-446655440000",
  "expiresIn": 900
}
```

### 2. Generate Download URL

**Endpoint:** `GET /v1/files/presign-download/:key`

**Example:**
```bash
GET /v1/files/presign-download/meetings/uuid/meeting-video.mp4
```

**Response:**
```json
{
  "downloadUrl": "https://s3.amazonaws.com/bucket-name/meetings/uuid/meeting-video.mp4?X-Amz-...",
  "key": "meetings/uuid/meeting-video.mp4",
  "expiresIn": 900
}
```

## 💻 Client-Side Examples

### Upload a File to S3

```javascript
// 1. Get authentication token (from login)
const token = localStorage.getItem('jwt'); // Your access token

// 2. Request a presigned upload URL
async function uploadFileToS3(file) {
  try {
    // Step 1: Get presigned URL from your API
    const presignResponse = await fetch('/v1/files/presign-upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type
      })
    });

    if (!presignResponse.ok) {
      throw new Error('Failed to get upload URL');
    }

    const { uploadUrl, key, meetingId } = await presignResponse.json();

    // Step 2: Upload directly to S3 using the presigned URL
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type
      },
      body: file
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload to S3');
    }

    console.log('File uploaded successfully!');
    console.log('S3 Key:', key);
    console.log('Meeting ID:', meetingId);

    return { key, meetingId };
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}

// Usage with file input
document.getElementById('fileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    const result = await uploadFileToS3(file);
    console.log('Upload complete:', result);
  }
});
```

### Download a File from S3

```javascript
async function downloadFileFromS3(s3Key) {
  try {
    // Step 1: Get presigned download URL
    const encodedKey = encodeURIComponent(s3Key);
    const presignResponse = await fetch(`/v1/files/presign-download/${encodedKey}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!presignResponse.ok) {
      throw new Error('Failed to get download URL');
    }

    const { downloadUrl } = await presignResponse.json();

    // Step 2: Download file from S3
    const downloadResponse = await fetch(downloadUrl);
    
    if (!downloadResponse.ok) {
      throw new Error('Failed to download from S3');
    }

    const blob = await downloadResponse.blob();
    
    // Step 3: Trigger browser download
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = s3Key.split('/').pop(); // Extract filename from key
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    console.log('Download complete!');
  } catch (error) {
    console.error('Download failed:', error);
    throw error;
  }
}

// Usage
downloadFileFromS3('meetings/550e8400-e29b-41d4-a716-446655440000/meeting-video.mp4');
```

### Upload with Progress Tracking

```javascript
async function uploadWithProgress(file, onProgress) {
  // Get presigned URL
  const presignResponse = await fetch('/v1/files/presign-upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fileName: file.name,
      fileType: file.type
    })
  });

  const { uploadUrl, key, meetingId } = await presignResponse.json();

  // Upload with XMLHttpRequest for progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percentComplete = (e.loaded / e.total) * 100;
        onProgress(percentComplete);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        resolve({ key, meetingId });
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed'));
    });

    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}

// Usage
const fileInput = document.getElementById('fileInput');
const progressBar = document.getElementById('progressBar');

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    await uploadWithProgress(file, (progress) => {
      progressBar.value = progress;
      console.log(`Upload progress: ${progress.toFixed(2)}%`);
    });
    console.log('Upload complete!');
  }
});
```

### React/TypeScript Example

```typescript
import { useState } from 'react';

interface PresignedUploadResponse {
  uploadUrl: string;
  key: string;
  meetingId: string;
  expiresIn: number;
}

export function FileUploader() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadFile = async (file: File) => {
    setUploading(true);
    setProgress(0);

    try {
      const token = localStorage.getItem('jwt');

      // Get presigned URL
      const response = await fetch('/v1/files/presign-upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type
        })
      });

      const data: PresignedUploadResponse = await response.json();

      // Upload to S3
      const uploadResponse = await fetch(data.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type
        },
        body: file
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      setProgress(100);
      console.log('Uploaded to:', data.key);
      
      return data;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadFile(file);
        }}
        disabled={uploading}
      />
      {uploading && <progress value={progress} max={100} />}
    </div>
  );
}
```

## 🔒 Security Notes

1. **Authentication Required:** Both endpoints require a valid Bearer token
2. **URL Expiration:** All pre-signed URLs expire in 15 minutes (900 seconds)
3. **Content-Type:** The upload URL enforces the content type specified in the request
4. **S3 Bucket:** Uses the bucket configured in `S3_BUCKET` environment variable

## 🚀 Integration with Existing Flow

This feature is **additive** and doesn't break existing functionality:

- **Old way:** Upload via `/v1/meetings` (file goes through server)
- **New way:** Get presigned URL from `/v1/files/presign-upload`, then upload directly to S3

You can use whichever method suits your use case:
- Use presigned URLs for large files (better performance)
- Use server upload for small files or when you need immediate server-side processing

## 📝 cURL Examples

### Get Upload URL
```bash
curl -X POST http://localhost:8080/v1/files/presign-upload \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "test-video.mp4",
    "fileType": "video/mp4"
  }'
```

### Upload to S3 (using presigned URL from above)
```bash
curl -X PUT "PRESIGNED_UPLOAD_URL" \
  -H "Content-Type: video/mp4" \
  --data-binary @test-video.mp4
```

### Get Download URL
```bash
curl http://localhost:8080/v1/files/presign-download/meetings/uuid/test-video.mp4 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Download from S3 (using presigned URL from above)
```bash
curl -o downloaded-video.mp4 "PRESIGNED_DOWNLOAD_URL"
```

## 🧪 Testing

1. **Login and get token:**
```bash
TOKEN=$(curl -s -X POST http://localhost:8080/v1/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"Test1234!"}' \
  | jq -r '.accessToken')
```

2. **Get upload URL:**
```bash
RESPONSE=$(curl -s -X POST http://localhost:8080/v1/files/presign-upload \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fileName":"test.mp4","fileType":"video/mp4"}')

UPLOAD_URL=$(echo $RESPONSE | jq -r '.uploadUrl')
S3_KEY=$(echo $RESPONSE | jq -r '.key')
```

3. **Upload file:**
```bash
curl -X PUT "$UPLOAD_URL" \
  -H "Content-Type: video/mp4" \
  --data-binary @test.mp4
```

4. **Get download URL:**
```bash
curl http://localhost:8080/v1/files/presign-download/$S3_KEY \
  -H "Authorization: Bearer $TOKEN"
```

