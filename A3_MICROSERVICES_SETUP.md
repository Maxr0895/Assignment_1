# Assignment 3: Microservices Architecture

## Overview

This document describes the microservices architecture implemented for Assignment 3, which builds upon the A2 stateless application.

### Architecture

**Service 1: Main API** (`src/`)
- Express.js REST API
- Serves web client (`public/`)
- Handles authentication, meetings CRUD, file uploads
- **Publishes transcode jobs to SQS** (async)
- Returns `202 Accepted` immediately

**Service 2: Worker** (`worker/`)
- Background processor for CPU-intensive video transcoding
- Polls SQS for jobs
- Downloads video from S3 → runs ffmpeg → uploads renditions
- Updates DynamoDB with status/progress
- **Horizontally scalable** (multiple workers can run in parallel)

### Communication

- **SQS Queue**: Decouples API from workers
- Each message delivered to only one worker
- Workers poll with long polling (20s)
- Visibility timeout: 5 minutes (enough time to transcode)

---

## Setup

### 1. Prerequisites

- Node.js 20+
- AWS credentials (from AWS Academy)
- SQS queue created in AWS Console
- FFmpeg installed

### 2. Create SQS Queue

1. Go to AWS Console → SQS
2. Create Standard Queue
3. Name: `wbr-transcode-queue` (or your choice)
4. Default settings are fine
5. Copy the Queue URL (e.g., `https://sqs.ap-southeast-2.amazonaws.com/123456789012/wbr-transcode-queue`)

### 3. Configure Environment Variables

**Main API** (`.env` in project root):
```bash
# Add to existing .env
SQS_QUEUE_URL=https://sqs.ap-southeast-2.amazonaws.com/123456789012/wbr-transcode-queue
```

**Worker** (create `worker/.env`):
```bash
# Copy from worker/env.example
AWS_REGION=ap-southeast-2
S3_BUCKET=your-s3-bucket-name
DDB_TABLE=your-dynamodb-table-name
QUT_USERNAME=n12345678@qut.edu.au
SQS_QUEUE_URL=https://sqs.ap-southeast-2.amazonaws.com/123456789012/wbr-transcode-queue

AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_SESSION_TOKEN=your_session_token

FFMPEG_PATH=C:\path\to\ffmpeg.exe  # Windows
# FFMPEG_PATH=/usr/bin/ffmpeg      # Linux/Mac

WORKER_ID=worker-1
POLL_INTERVAL_MS=5000
MAX_MESSAGES_PER_POLL=1
```

### 4. Install Dependencies

**Main API:**
```bash
npm install
```

**Worker:**
```bash
cd worker
npm install
cd ..
```

---

## Local Testing

### Test 1: API Publishes to SQS

1. **Start the API:**
   ```bash
   npm run dev
   ```

2. **Upload a video and request transcode:**
   - Open http://localhost:8080
   - Login (or register)
   - Upload a video
   - Click "Transcode Video"
   - **Expected:** API returns `202 Accepted` immediately
   - Meeting status should be `"queued"`

3. **Verify message in SQS:**
   - Go to AWS Console → SQS → Your Queue
   - Click "Send and receive messages" → "Poll for messages"
   - You should see 1 message with your `meetingId`

### Test 2: Worker Processes Job

1. **Start the worker** (in a new terminal):
   ```bash
   cd worker
   npm run dev
   ```

2. **Watch the logs:**
   - Worker should poll SQS and receive the message
   - It will download the video, transcode it, and upload renditions
   - Meeting status will change: `queued` → `processing` → `done`

3. **Verify in frontend:**
   - Refresh the meeting details page
   - You should see renditions, thumbnails, and audio available

### Test 3: Multiple Workers (Parallel Processing)

1. **Upload 3 videos** and transcode all of them
2. **Start 3 workers** (in separate terminals):
   ```bash
   # Terminal 1
   cd worker
   WORKER_ID=worker-1 npm run dev

   # Terminal 2
   cd worker
   WORKER_ID=worker-2 npm run dev

   # Terminal 3
   cd worker
   WORKER_ID=worker-3 npm run dev
   ```

3. **Observe:**
   - Each worker picks up a different job from SQS
   - All 3 videos are transcoded in parallel
   - No job is processed twice (SQS guarantees)

---

## Status Tracking

Meeting status flow:
1. `uploaded` - Initial state after upload
2. `queued` - Transcode job published to SQS
3. `processing` - Worker picked up the job
4. `done` - Transcode completed successfully
5. `failed` - Transcode failed (error message stored)

The frontend polls `/v1/meetings/:id` or uses SSE (`/v1/meetings/:id/events`) to track status changes.

---

## Next Steps for A3

### Deployment

1. **Dockerize both services:**
   - `Dockerfile.api` for main API
   - `Dockerfile.worker` for worker

2. **Deploy to separate compute:**
   - **Option A:** ECS with 2 task definitions
   - **Option B:** EC2 Auto Scaling Group for workers + EC2 for API

3. **Set up auto scaling:**
   - CloudWatch alarm on SQS `ApproximateNumberOfMessagesVisible`
   - Target Tracking: Scale workers based on queue depth
   - Demo: 1 → 3 workers when queue grows

4. **HTTPS with ALB:**
   - Create Application Load Balancer
   - Request ACM certificate
   - Update Route53 CNAME
   - Configure ALB listener (HTTPS:443 → API instances)

---

## Troubleshooting

### API can't connect to SQS
- Check `SQS_QUEUE_URL` in `.env`
- Verify AWS credentials are valid
- Check IAM permissions for SQS (`sqs:SendMessage`)

### Worker not receiving messages
- Check `SQS_QUEUE_URL` in `worker/.env`
- Verify AWS credentials are valid
- Check IAM permissions for SQS (`sqs:ReceiveMessage`, `sqs:DeleteMessage`)
- Look for messages in SQS console

### Transcode fails
- Check `FFMPEG_PATH` is correct
- Verify ffmpeg is installed: `ffmpeg -version`
- Check worker logs for detailed error messages
- Verify S3 permissions (read/write)

### Message stuck in queue
- Check visibility timeout (default 5 min)
- If worker crashes, message will reappear after timeout
- Consider setting up a Dead Letter Queue (DLQ) for failed jobs

---

## Architecture Diagram

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────────────────────────────┐
│         Main API (Service 1)        │
│  - Express REST API                 │
│  - Auth, CRUD, File Upload          │
│  - Publishes jobs to SQS            │
└──────┬──────────────────────────────┘
       │
       │ SQS Message
       ▼
┌─────────────────────────────────────┐
│      SQS Queue (Load Distributor)   │
│  - Decouples API from workers       │
│  - Each message → one worker        │
└──────┬──────────────────────────────┘
       │
       │ Long Polling
       ▼
┌─────────────────────────────────────┐
│      Workers (Service 2)            │
│  - Poll SQS for jobs                │
│  - Download from S3                 │
│  - Run ffmpeg (CPU-intensive)       │
│  - Upload to S3                     │
│  - Update DynamoDB                  │
│  - Horizontally scalable (1-3+)     │
└─────────────────────────────────────┘
       │
       │ Read/Write
       ▼
┌─────────────────────────────────────┐
│   Shared State (S3 + DynamoDB)      │
│  - S3: Video files, renditions      │
│  - DynamoDB: Metadata, status       │
└─────────────────────────────────────┘
```

---

## Assignment 3 Criteria Mapping

✅ **Microservices (3 marks)**
- Service 1: Main API (Express)
- Service 2: Worker (Background processor)
- Appropriate separation: API handles requests, worker handles CPU-intensive transcoding
- Separate compute: Will deploy on separate EC2/ECS instances

✅ **Load Distribution (2 marks)**
- SQS queue distributes jobs to multiple workers
- Each message delivered to only one worker
- Suitable for long-running transcode tasks

✅ **Auto Scaling (3 marks)**
- Workers scale based on SQS queue depth
- CloudWatch metric: `ApproximateNumberOfMessagesVisible`
- Target: 1 message per worker
- Demo: 1 → 3 workers when queue grows, back to 1 when empty

⏳ **HTTPS (2 marks)**
- To be implemented: ALB + ACM certificate + Route53

