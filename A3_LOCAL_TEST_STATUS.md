# Assignment 3 - Local Test Status

## ✅ Setup Complete

### 1. Dependencies Installed
- ✅ Main API: `@aws-sdk/client-sqs` installed
- ✅ Worker: All dependencies installed

### 2. Environment Variables Configured
- ✅ Main API `.env`: Added `SQS_QUEUE_URL`
- ✅ Worker `.env`: Created with all AWS credentials and config
- ✅ Queue: `n8501645-job-queue` in `ap-southeast-2`

### 3. Services Running
- ✅ **Terminal 1**: Main API (`npm run dev`) - Port 8080
- ✅ **Terminal 2**: Worker (`cd worker && npm run dev`)

---

## 🧪 Testing Steps

### Test 1: Verify Services Are Running

**Check API:**
```bash
# In a new terminal
curl http://localhost:8080/health
```

Expected response:
```json
{
  "ok": true,
  "uptime": 123.45,
  "openaiAvailable": true,
  "stateless": true
}
```

**Check Worker Logs:**
Look for these messages in Terminal 2:
```
🚀 Worker worker-1 started
📊 Polling SQS queue: https://sqs.ap-southeast-2.amazonaws.com/901444280953/n8501645-job-queue
⏱️  Poll interval: 5000ms
📦 Max messages per poll: 1
💤 No messages in queue, waiting 5000ms...
```

---

### Test 2: Upload and Transcode a Video

1. **Open browser:** http://localhost:8080

2. **Login:**
   - Username: `maxr0895` (or your Cognito user)
   - Password: Your password
   - Complete MFA if prompted

3. **Upload a video:**
   - Click "Upload Meeting"
   - Select a small video file (e.g., 10-30 seconds)
   - Enter title
   - Click "Upload"

4. **Request transcode:**
   - Click "View Detail" on your uploaded meeting
   - Click "Transcode Video"
   - **Expected:** Immediate response with `202 Accepted`
   - Meeting status should show `"queued"`

5. **Watch the worker process it:**
   - **Terminal 2** should show:
     ```
     📨 Received 1 message(s) from SQS
     🎬 Processing transcode job for meeting <meeting-id>
     🎬 Starting transcode for meeting <meeting-id>
     📥 Downloading from S3: meetings/<meeting-id>/<filename>
     🎬 Running ffmpeg transcode...
     📤 Uploading renditions to S3...
     ✅ Transcode completed for meeting <meeting-id>
     ✅ Job completed for meeting <meeting-id>
     🗑️  Message deleted from SQS
     ```

6. **Verify completion:**
   - Refresh meeting details page
   - Status should be `"done"`
   - You should see:
     - ✅ 3 renditions (720p, 480p, 360p)
     - ✅ Audio file
     - ✅ 3 thumbnails
     - ✅ Duration

---

### Test 3: Verify SQS Queue (AWS Console)

1. Go to AWS Console → SQS
2. Click on `n8501645-job-queue`
3. Click "Send and receive messages" → "Poll for messages"
4. **Before transcode:** Should be empty
5. **After clicking "Transcode Video":** Should see 1 message briefly
6. **After worker processes:** Should be empty again (message deleted)

---

## 📊 Status Flow to Watch

```
1. Upload video → status: "uploaded"
2. Click "Transcode Video" → API returns 202 Accepted
3. Check DynamoDB/frontend → status: "queued"
4. Worker picks up job → status: "processing"
5. Worker completes → status: "done"
```

---

## 🐛 Troubleshooting

### API won't start
- Check Terminal 1 for errors
- Verify `.env` has `SQS_QUEUE_URL`
- Check port 8080 is not in use: `netstat -ano | findstr :8080`

### Worker won't start
- Check Terminal 2 for errors
- Verify `worker/.env` exists and has all required vars
- Check AWS credentials are valid (not expired)

### Worker not receiving messages
- Check worker logs for "Polling SQS queue" message
- Verify `SQS_QUEUE_URL` is correct in `worker/.env`
- Check IAM permissions for SQS (`sqs:ReceiveMessage`, `sqs:DeleteMessage`)
- Look for messages in AWS Console → SQS

### Transcode fails
- Check worker logs for detailed error
- Common issues:
  - FFmpeg path incorrect → Check `FFMPEG_PATH` in `worker/.env`
  - S3 permissions → Verify IAM role has S3 read/write
  - DynamoDB permissions → Verify IAM role has DynamoDB read/write
  - AWS credentials expired → Get fresh credentials from AWS Academy

### Message stuck in queue
- Default visibility timeout: 5 minutes
- If worker crashes, message will reappear after timeout
- Check worker logs for errors
- Consider setting up Dead Letter Queue (DLQ) for failed jobs

---

## 🎯 Success Criteria

✅ API starts without errors  
✅ Worker starts and polls SQS  
✅ Upload video succeeds  
✅ Transcode returns `202 Accepted` immediately  
✅ Message appears in SQS queue  
✅ Worker receives and processes message  
✅ Meeting status changes: `queued` → `processing` → `done`  
✅ Renditions appear in S3 and frontend  
✅ Message deleted from SQS after completion  

---

## 📝 Next Steps

Once local testing works:

1. **Test with multiple workers:**
   - Upload 3 videos
   - Start 3 workers (different `WORKER_ID`)
   - Watch parallel processing

2. **Dockerize:**
   - Create `Dockerfile.api`
   - Create `Dockerfile.worker`
   - Test with `docker-compose`

3. **Deploy to AWS:**
   - ECS with 2 task definitions, OR
   - EC2 Auto Scaling Group

4. **Set up auto scaling:**
   - CloudWatch alarm on SQS queue depth
   - Scale workers 1 → 3

5. **Add HTTPS:**
   - Application Load Balancer
   - ACM certificate
   - Route53 CNAME

---

## 📚 Useful Commands

**Check if services are running:**
```powershell
# API
curl http://localhost:8080/health

# Worker (check logs in Terminal 2)
```

**Stop services:**
```powershell
# Press Ctrl+C in each terminal
```

**Restart services:**
```powershell
# Terminal 1
npm run dev

# Terminal 2
cd worker
npm run dev
```

**Check SQS queue:**
```bash
aws sqs get-queue-attributes --queue-url https://sqs.ap-southeast-2.amazonaws.com/901444280953/n8501645-job-queue --attribute-names ApproximateNumberOfMessages
```

**Send test message to SQS:**
```bash
aws sqs send-message --queue-url https://sqs.ap-southeast-2.amazonaws.com/901444280953/n8501645-job-queue --message-body '{"meetingId":"test-123","userId":"test-user","requestedAt":"2025-01-01T00:00:00Z"}'
```

