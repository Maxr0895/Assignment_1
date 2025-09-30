# WBR Actionizer (Stateless)

A fully **stateless** REST API for Weekly Business Review action item extraction from video meetings. Features CPU-intensive video transcoding, AWS Cognito authentication, S3/DynamoDB storage, and optional OpenAI integration.

## 🚀 Key Features

- **Fully Stateless**: No sessions, no local storage - all state in S3 & DynamoDB
- **AWS Cognito Auth**: Pure bearer token authentication with JWT verification
- **S3 Storage**: All media files stored in AWS S3 with presigned URLs
- **DynamoDB**: Single-table design for all metadata
- **Idempotent Operations**: Retry-safe with Idempotency-Key support
- **Temp File Hygiene**: Automatic cleanup of ffmpeg intermediate files
- **Status Tracking**: Meeting processing status persisted in DynamoDB
- **Docker Ready**: Containerized deployment with zero local dependencies

## 📋 Prerequisites

- Node.js 20+
- AWS Account with:
  - S3 bucket created
  - DynamoDB table created (partition key: `qut-username`, sort key: `sk`)
  - Cognito User Pool with app client configured
- FFmpeg installed (for local development)

## 🏃 Quick Start

### 1. Clone and Install

```bash
git clone <your-repo>
cd Assignment_1
npm install
```

### 2. Configure Environment

```bash
cp env.example .env
# Edit .env with your AWS credentials and Cognito details
```

**Required environment variables**:
```env
# Server
PORT=8080
JWT_SECRET=your_jwt_secret_here

# AWS Services
AWS_REGION=ap-southeast-2
S3_BUCKET=your-bucket-name
DDB_TABLE=your-table-name
QUT_USERNAME=n12345678@qut.edu.au

# AWS Credentials (from AWS Academy)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_SESSION_TOKEN=your_session_token

# Cognito
COGNITO_USER_POOL_ID=your-pool-id
COGNITO_CLIENT_ID=your-client-id

# FFmpeg
FFMPEG_PATH=/usr/bin/ffmpeg  # or C:\path\to\ffmpeg.exe on Windows

# Optional
OPENAI_API_KEY=sk-...
```

### 3. Register a User

```bash
# Register
curl -X POST http://localhost:8080/v1/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "Test1234!"
  }'

# Confirm (use code from email)
curl -X POST http://localhost:8080/v1/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "code": "123456"
  }'
```

### 4. Run the Server

```bash
npm run dev
```

Visit `http://localhost:8080` to access the web UI.

## 🔐 Authentication Flow

**100% stateless - no sessions!**

1. **Register**: `POST /v1/register` → creates Cognito user
2. **Confirm**: `POST /v1/confirm` → verifies email with code
3. **Login**: `POST /v1/login` → returns `accessToken` and `idToken`
4. **API Calls**: Include `Authorization: Bearer <accessToken>` header

```bash
# Login
RESPONSE=$(curl -s -X POST http://localhost:8080/v1/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"Test1234!"}')

# Extract access token
TOKEN=$(echo $RESPONSE | jq -r '.accessToken')

# Use in API calls
curl -X GET http://localhost:8080/v1/meetings \
  -H "Authorization: Bearer $TOKEN"
```

## 📡 API Endpoints

### Authentication (Public)

- `POST /v1/register` - Register new user
- `POST /v1/confirm` - Confirm email with code
- `POST /v1/login` - Login (returns JWT tokens)
- `POST /v1/reset-password` - Reset password with code

### Meetings (Protected)

- `POST /v1/meetings` - Upload video (multipart form)
- `GET /v1/meetings` - List meetings
- `GET /v1/meetings/:id` - Get meeting details with presigned URLs

### Processing (Protected)

- `POST /v1/meetings/:id/transcode` - Transcode video (CPU-intensive)
- `POST /v1/meetings/:id/transcribe` - Generate transcript
- `POST /v1/meetings/:id/actions` - Extract action items

### Reports (Protected)

- `GET /v1/reports/wbr-summary` - Weekly business review summary

### Health

- `GET /health` - Health check (public)

## 🔄 Stateless Operation

### Status Tracking

Meeting status is persisted in DynamoDB:
- `uploaded` → `processing` → `done` | `failed`

```bash
# Check meeting status
curl http://localhost:8080/v1/meetings/MEETING_ID \
  -H "Authorization: Bearer $TOKEN" | jq '.status'
```

### Idempotency

Add `Idempotency-Key` header to prevent duplicate processing:

```bash
curl -X POST http://localhost:8080/v1/meetings/MEETING_ID/transcode \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: unique-key-123"
```

### Temp File Cleanup

All ffmpeg operations use `os.tmpdir()` with automatic cleanup:
- Temp directory created per operation
- Files cleaned up in `finally` block
- No persistent local storage

## 🐳 Docker Deployment

### Build

```bash
docker build -t wbr-actionizer .
```

### Run

```bash
docker run -d \
  -p 8080:8080 \
  -e AWS_REGION=ap-southeast-2 \
  -e S3_BUCKET=your-bucket \
  -e DDB_TABLE=your-table \
  -e QUT_USERNAME=n12345678@qut.edu.au \
  -e AWS_ACCESS_KEY_ID=... \
  -e AWS_SECRET_ACCESS_KEY=... \
  -e AWS_SESSION_TOKEN=... \
  -e COGNITO_USER_POOL_ID=... \
  -e COGNITO_CLIENT_ID=... \
  -e JWT_SECRET=prod-secret \
  --name wbr \
  wbr-actionizer
```

### EC2 Deployment

1. **Push to ECR**:
```bash
aws ecr create-repository --repository-name wbr-actionizer
docker tag wbr-actionizer:latest ACCOUNT.dkr.ecr.REGION.amazonaws.com/wbr-actionizer:latest
docker push ACCOUNT.dkr.ecr.REGION.amazonaws.com/wbr-actionizer:latest
```

2. **Run on EC2** (with IAM role for S3/DynamoDB):
```bash
docker pull ACCOUNT.dkr.ecr.REGION.amazonaws.com/wbr-actionizer:latest
docker run -d -p 80:8080 \
  -e AWS_REGION=ap-southeast-2 \
  -e S3_BUCKET=... \
  -e DDB_TABLE=... \
  -e QUT_USERNAME=... \
  -e COGNITO_USER_POOL_ID=... \
  -e COGNITO_CLIENT_ID=... \
  -e JWT_SECRET=... \
  ACCOUNT.dkr.ecr.REGION.amazonaws.com/wbr-actionizer:latest
```

## ✅ Acceptance Tests

### Test Stateless Operation

1. **Upload and transcode a video**:
```bash
MEETING_ID=$(curl -X POST http://localhost:8080/v1/meetings \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.mp4" | jq -r '.meetingId')

curl -X POST http://localhost:8080/v1/meetings/$MEETING_ID/transcode \
  -H "Authorization: Bearer $TOKEN"
```

2. **Kill the container mid-processing**:
```bash
docker rm -f wbr
```

3. **Restart the container**:
```bash
docker run -d -p 8080:8080 ... --name wbr wbr-actionizer
```

4. **Re-trigger transcode** (should safely overwrite):
```bash
curl -X POST http://localhost:8080/v1/meetings/$MEETING_ID/transcode \
  -H "Authorization: Bearer $TOKEN"
```

**Expected**:
- ✅ S3 objects and DynamoDB items are intact
- ✅ Re-running completes successfully
- ✅ Status updates to `done`

### Test Idempotency

```bash
# Run twice with same key
curl -X POST http://localhost:8080/v1/meetings/$MEETING_ID/transcode \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: test-123"

curl -X POST http://localhost:8080/v1/meetings/$MEETING_ID/transcode \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: test-123"
```

**Expected**:
- ✅ Second request returns cached result immediately

## 🏗️ Architecture

### Single-Table DynamoDB Design

**Partition Key**: `qut-username` (always your QUT email)  
**Sort Key**: `sk` (entity type + ID)

Entity types:
- `MEETING#<uuid>` - Meeting metadata + status
- `REND#<meetingId>#<resolution>` - Rendition metadata
- `CAPTIONS#<meetingId>` - Caption metadata
- `ACTION#<meetingId>#<actionId>` - Action item
- `IDEMP#<key>` - Idempotency tracking (24h TTL)

### S3 Storage Pattern

```
meetings/<meetingId>/
  input.mp4
  out_1080p.mp4
  out_720p.mp4
  audio.mp3
  captions.srt
  captions.vtt
  thumbs_0.jpg
  thumbs_2.jpg
  ...
```

All file access via presigned URLs (expire in 1 hour).

### Temp File Lifecycle

```typescript
let tempDir = await makeTempDir('transcode');
try {
  // Download from S3 → tempDir
  // Process with ffmpeg
  // Upload to S3
} finally {
  await cleanupDir(tempDir); // Always cleanup
}
```

## 📊 Project Structure

```
/src
  server.ts           # Express setup (NO sessions)
  config.ts          # Environment config
  /middleware
    auth.ts          # JWT verification with aws-jwt-verify
  /routes
    auth.ts          # Registration, login (stateless)
    meetings.ts      # CRUD operations
    processing.ts    # Transcode, transcribe, actions
    reports.ts       # WBR summary
  /services
    s3.ts            # S3 operations with presigned URLs
    ddb.ts           # DynamoDB operations
    ffmpegService.ts # Video transcoding
    openaiService.ts # AI integration
    cognitoAuth.ts   # Direct Cognito API calls
  /utils
    temp.ts          # Temp directory management
```

## 🔧 Troubleshooting

### "Token has expired" errors

AWS Academy credentials expire every few hours. Refresh:
1. Go to AWS Academy Learner Lab
2. Click "AWS Details"
3. Copy fresh credentials
4. Update `.env`
5. Restart server

### "Invalid token issuer"

Check `COGNITO_USER_POOL_ID` matches your actual pool ID.

### Transcode fails

Ensure `FFMPEG_PATH` is correct for your OS.

## 📝 License

MIT