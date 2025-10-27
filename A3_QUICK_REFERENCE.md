# Assignment 3 - Quick Reference Card

## 🎯 Deployment Checklist

- [x] **IAM Role Verified** → AWS Academy `LabRole` exists (no custom role needed)
- [ ] **Code Pushed to GitHub** → Ensure `.env` not committed
- [ ] **API EC2 Launched** → With IAM role attached
- [ ] **Worker EC2 Launched** → With IAM role attached
- [ ] **Services Running** → Upload/transcode working
- [ ] **Launch Template Created** → From working Worker instance
- [ ] **Auto Scaling Group Created** → Min: 1, Max: 3
- [ ] **Scaling Policy Configured** → Target Tracking on SQS queue depth
- [ ] **Auto Scaling Tested** → 1→3→1 demonstrated
- [ ] **ALB Created** → With HTTPS listener
- [ ] **ACM Certificate** → Requested and validated
- [ ] **Route 53 DNS** → Pointing to ALB

---

## 📋 Key Information

| Resource | Value |
|----------|-------|
| **IAM Role** | `LabRole` (AWS Academy pre-created) |
| **S3 Bucket** | `n8501645-a2` |
| **DynamoDB Table** | `n8501645-meetings` |
| **SQS Queue** | `n8501645-job-queue` |
| **Queue URL** | `https://sqs.ap-southeast-2.amazonaws.com/901444280953/n8501645-job-queue` |
| **Secrets Manager** | `a2-n8501645` |
| **SSM Parameter** | `/wbr/api_base_url` |
| **Cognito User Pool** | `ap-southeast-2_9tnsroRRj` |
| **Region** | `ap-southeast-2` |

---

## 🔐 IAM Role (LabRole)

AWS Academy's `LabRole` is pre-configured with broad permissions.

**Permissions included:**
- ✅ S3: Read/Write to `n8501645-a2` bucket
- ✅ DynamoDB: CRUD on `n8501645-meetings` table
- ✅ SQS: Send/Receive/Delete messages on `n8501645-job-queue`
- ✅ Secrets Manager: Get secret `a2-n8501645-*`
- ✅ SSM Parameter Store: Get parameter `/wbr/api_base_url`
- ✅ CloudWatch Logs: Write logs to `/aws/ec2/n8501645-*`

---

## 🖥️ EC2 Instances

### API Instance
- **Name:** `n8501645-api`
- **Type:** t2.medium (or t3.medium)
- **Security Group:** `n8501645-api-sg`
  - SSH (22) from My IP
  - HTTP (80) from Anywhere
  - HTTPS (443) from Anywhere
  - Custom TCP (8080) from Anywhere
- **IAM Role:** `LabRole` ⚠️ **REQUIRED**
- **Service:** API (port 8080)

### Worker Instance
- **Name:** `n8501645-worker`
- **Type:** t2.medium (or t3.medium)
- **Security Group:** `n8501645-worker-sg`
  - SSH (22) from My IP
- **IAM Role:** `LabRole` ⚠️ **REQUIRED**
- **Service:** Worker (polls SQS)

---

## 📦 Required Software

### API Instance
- Node.js 20
- npm
- git
- pm2 (process manager)

### Worker Instance
- Node.js 20
- npm
- git
- pm2 (process manager)
- **ffmpeg** (for video transcoding)

---

## 🚀 Quick Commands

### Start Services with PM2
```bash
# API (in ~/Assignment_1)
pm2 start npm --name "wbr-api" -- run dev
pm2 save

# Worker (in ~/Assignment_1/worker)
pm2 start npm --name "wbr-worker" -- run dev
pm2 save
```

### Monitor Services
```bash
pm2 list          # Show all services
pm2 logs wbr-api  # View API logs
pm2 logs wbr-worker  # View Worker logs
pm2 restart wbr-api  # Restart API
pm2 stop wbr-worker  # Stop Worker
```

### Check IAM Role
```bash
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/
# Should return: LabRole
```

### Test ffmpeg
```bash
which ffmpeg  # Should return /usr/bin/ffmpeg
ffmpeg -version  # Should show version
```

---

## 🔧 Environment Variables

### API `.env` (no AWS credentials!)
```env
PORT=8080
NODE_ENV=production
AWS_REGION=ap-southeast-2
S3_BUCKET=n8501645-a2
DDB_TABLE=n8501645-meetings
QUT_USERNAME=n8501645
SQS_QUEUE_URL=https://sqs.ap-southeast-2.amazonaws.com/901444280953/n8501645-job-queue
COGNITO_USER_POOL_ID=ap-southeast-2_9tnsroRRj
COGNITO_CLIENT_ID=<your_client_id>
OPENAI_SECRET_NAME=a2-n8501645
API_BASE_URL_PARAM=/wbr/api_base_url
API_BASE_URL=http://<API_PUBLIC_IP>:8080
```

### Worker `.env` (no AWS credentials!)
```env
AWS_REGION=ap-southeast-2
S3_BUCKET=n8501645-a2
DDB_TABLE=n8501645-meetings
QUT_USERNAME=n8501645
SQS_QUEUE_URL=https://sqs.ap-southeast-2.amazonaws.com/901444280953/n8501645-job-queue
FFMPEG_PATH=/usr/bin/ffmpeg
```

---

## 📊 Auto Scaling Configuration

### Target Tracking Policy
- **Metric:** `ApproximateNumberOfMessagesVisible` (SQS)
- **Target Value:** 5 messages per instance
- **Scale Out:** When queue depth > 5 × instance count
- **Scale In:** When queue depth < 5 × instance count
- **Cooldown:** 300 seconds (scale out), 600 seconds (scale in)

### ASG Settings
- **Minimum:** 1 instance
- **Desired:** 1 instance
- **Maximum:** 3 instances

---

## 🎬 Demo Video Checklist

### Microservices
- [ ] Show EC2 Instances page with API + Worker running
- [ ] Mention: "API handles auth and uploads, Worker processes videos"

### Load Distribution
- [ ] Show SQS Queue page with metrics
- [ ] Mention: "Workers poll this queue, allowing parallel processing"

### Auto Scaling
- [ ] Show ASG with 1 instance (initial state)
- [ ] Upload 10-20 videos
- [ ] Show queue depth increasing
- [ ] Show ASG scaling to 3 instances
- [ ] Show queue draining
- [ ] Show ASG scaling back to 1 instance
- [ ] Show CloudWatch graphs: instance count + queue depth

### HTTPS
- [ ] Show ALB page
- [ ] Show ACM certificate (validated)
- [ ] Show Route 53 DNS record
- [ ] Access app via HTTPS URL

---

## 🐛 Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| `ExpiredToken` | No IAM role attached | Attach `n8501645-ec2-role` to instance |
| `AccessDenied` | IAM policy missing permissions | Check `A3_IAM_ROLE_POLICY.json` |
| `ENOENT ffmpeg` | ffmpeg not installed | `sudo dnf install -y ffmpeg` (Amazon Linux) or `sudo apt-get install -y ffmpeg` (Ubuntu) |
| Worker not polling | Service not started | `pm2 restart wbr-worker` |
| API not responding | Port 8080 blocked | Check security group rules |

---

## 📞 Support Resources

- **Full Deployment Guide:** `A3_EC2_DEPLOYMENT.md`
- **IAM Policy:** `A3_IAM_ROLE_POLICY.json`
- **Microservices Setup:** `A3_MICROSERVICES_SETUP.md`
- **Local Testing:** `A3_LOCAL_TEST_STATUS.md`

