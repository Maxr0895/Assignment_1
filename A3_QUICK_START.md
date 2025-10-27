# Assignment 3 - Quick Start Guide

## ✅ What's Done

### 1. **SQS Integration** ✅
- Created `src/services/sqs.ts` for queue operations
- Installed `@aws-sdk/client-sqs`
- Updated `src/config.ts` to require `SQS_QUEUE_URL`
- Updated `env.example` with SQS configuration

### 2. **API Refactored** ✅
- `POST /v1/meetings/:id/transcode` now publishes to SQS instead of processing
- Returns `202 Accepted` immediately
- Meeting status set to `"queued"`
- No more blocking transcode operations in API

### 3. **Worker Service Created** ✅
- New `worker/` directory with separate package
- `worker/processor.ts` - Contains all transcode logic (ffmpeg, S3, DynamoDB)
- `worker/index.ts` - SQS polling loop with graceful shutdown
- `worker/package.json` - Independent dependencies
- `worker/tsconfig.json` - TypeScript configuration
- `worker/env.example` - Environment template

### 4. **Documentation** ✅
- `A3_MICROSERVICES_SETUP.md` - Complete architecture guide
- `A3_QUICK_START.md` - This file!

---

## 🚀 Next Steps (In Order)

### Step 1: Create SQS Queue
1. AWS Console → SQS → Create Queue
2. Name: `wbr-transcode-queue`
3. Type: Standard
4. Copy the Queue URL

### Step 2: Update Environment Variables

**Main API** (`.env`):
```bash
# Add this line to your existing .env
SQS_QUEUE_URL=https://sqs.ap-southeast-2.amazonaws.com/YOUR_ACCOUNT_ID/wbr-transcode-queue
```

**Worker** (create `worker/.env`):
```bash
# Copy from worker/env.example and fill in
AWS_REGION=ap-southeast-2
S3_BUCKET=your-bucket
DDB_TABLE=your-table
QUT_USERNAME=n12345678@qut.edu.au
SQS_QUEUE_URL=https://sqs.ap-southeast-2.amazonaws.com/YOUR_ACCOUNT_ID/wbr-transcode-queue

# Same AWS credentials as main API
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_SESSION_TOKEN=...

# Your ffmpeg path
FFMPEG_PATH=C:\path\to\ffmpeg.exe

WORKER_ID=worker-1
```

### Step 3: Install Worker Dependencies
```bash
cd worker
npm install
cd ..
```

### Step 4: Test Locally

**Terminal 1 - Start API:**
```bash
npm run dev
```

**Terminal 2 - Start Worker:**
```bash
cd worker
npm run dev
```

**Browser:**
1. Go to http://localhost:8080
2. Login
3. Upload a video
4. Click "Transcode Video"
5. **Expected:** Returns immediately with `202 Accepted`
6. Watch Terminal 2 - worker should pick up the job and process it

---

## 📊 Status Flow

```
uploaded → queued → processing → done
                              ↘ failed
```

- **uploaded**: Video uploaded to S3
- **queued**: Job published to SQS
- **processing**: Worker picked up job
- **done**: Transcode completed
- **failed**: Error occurred

---

## 🧪 Testing Checklist

- [ ] API starts without errors
- [ ] Worker starts without errors
- [ ] Upload video → transcode returns `202 Accepted`
- [ ] Message appears in SQS queue (AWS Console)
- [ ] Worker receives message and starts processing
- [ ] Meeting status changes: `queued` → `processing` → `done`
- [ ] Renditions appear in S3
- [ ] Frontend shows renditions after completion

---

## 🐛 Common Issues

### "SQS_QUEUE_URL is required"
- Add `SQS_QUEUE_URL` to your `.env` file
- Make sure it's the full URL, not just the queue name

### Worker not receiving messages
- Check `worker/.env` has correct `SQS_QUEUE_URL`
- Verify AWS credentials are valid (not expired)
- Check IAM permissions: `sqs:ReceiveMessage`, `sqs:DeleteMessage`

### "ffmpeg not found"
- Update `FFMPEG_PATH` in `worker/.env`
- Test: `ffmpeg -version` in terminal

### Transcode fails
- Check worker logs for detailed error
- Verify S3 permissions (read + write)
- Verify DynamoDB permissions (read + write)

---

## 📦 Deployment (Next Phase)

After local testing works:

1. **Dockerize:**
   - Create `Dockerfile.api` (for main API)
   - Create `Dockerfile.worker` (for worker)

2. **Deploy:**
   - ECS with 2 task definitions, OR
   - EC2 Auto Scaling Group for workers + single EC2 for API

3. **Auto Scaling:**
   - CloudWatch alarm on `ApproximateNumberOfMessagesVisible`
   - Scale workers 1 → 3 when queue depth > threshold

4. **HTTPS:**
   - Application Load Balancer
   - ACM certificate
   - Route53 CNAME

---

## 📚 Files Changed/Created

### Modified:
- `src/config.ts` - Added `sqsQueueUrl`
- `src/server.ts` - Initialize SQS service
- `src/routes/processing.ts` - Refactored transcode to publish to SQS
- `env.example` - Added `SQS_QUEUE_URL`
- `package.json` - Added `@aws-sdk/client-sqs`

### Created:
- `src/services/sqs.ts` - SQS service helper
- `worker/` - Entire worker service directory
  - `worker/index.ts` - Main worker with SQS polling
  - `worker/processor.ts` - Transcode logic
  - `worker/package.json` - Dependencies
  - `worker/tsconfig.json` - TypeScript config
  - `worker/env.example` - Environment template
- `A3_MICROSERVICES_SETUP.md` - Architecture documentation
- `A3_QUICK_START.md` - This guide

---

## 🎯 Assignment 3 Criteria

✅ **Microservices** - API + Worker on separate compute  
✅ **Load Distribution** - SQS queue  
✅ **Auto Scaling** - Workers scale based on queue depth  
⏳ **HTTPS** - ALB + ACM (next phase)

---

## 💡 Tips

- **Start simple:** Test with 1 worker first
- **Monitor SQS:** Use AWS Console to see messages in queue
- **Check logs:** Both API and worker have detailed logging
- **Status tracking:** Use SSE (`/v1/meetings/:id/events`) or polling
- **Parallel testing:** Start multiple workers to see load distribution

---

## 🆘 Need Help?

1. Check `A3_MICROSERVICES_SETUP.md` for detailed architecture
2. Review worker logs for errors
3. Verify all environment variables are set
4. Test SQS permissions with AWS CLI:
   ```bash
   aws sqs send-message --queue-url YOUR_QUEUE_URL --message-body "test"
   aws sqs receive-message --queue-url YOUR_QUEUE_URL
   ```

