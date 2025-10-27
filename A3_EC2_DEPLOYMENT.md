# Assignment 3 - EC2 Deployment Guide with IAM Roles

## 📋 Overview

This guide walks you through deploying the WBR Actionizer to EC2 with:
- **IAM Role** for AWS service access (no hardcoded credentials!)
- **API Service** on one EC2 instance
- **Worker Service** on another EC2 instance (will become ASG later)
- **Auto Scaling Group** for worker horizontal scaling

---

## 🔐 Step 1: Use AWS Academy LabRole

⚠️ **AWS Academy Learner Lab Note:** You cannot create custom IAM roles in AWS Academy. Instead, use the pre-created `LabRole` which already has permissions for S3, DynamoDB, SQS, Secrets Manager, SSM, and CloudWatch.

### 1.1 Verify LabRole Exists

1. Go to **IAM Console** → **Roles**
2. Search for `LabRole`
3. Verify it exists and has policies attached (e.g., `LabPolicy`)

✅ **Done!** You'll use `LabRole` when launching EC2 instances. This role already has all the permissions you need without credentials in `.env`.

---

## 📦 Step 2: Push Code to GitHub

### 2.1 Ensure `.env` is NOT Committed

```bash
# Check .gitignore includes .env
cat .gitignore

# Should include:
.env
node_modules
```

### 2.2 Commit and Push

```bash
git add .
git commit -m "A3: Microservices architecture with SQS"
git push origin master
```

---

## 🖥️ Step 3: Launch EC2 Instances

### 3.1 Launch API Instance

1. Go to **EC2 Console** → **Instances** → **Launch instances**
2. **Name:** `n8501645-api`
3. **AMI:** Amazon Linux 2023 (or Ubuntu 22.04)
4. **Instance type:** t2.medium (for testing) or t3.medium
5. **Key pair:** Select your existing key pair (or create new)
6. **Network settings:**
   - **VPC:** Default
   - **Auto-assign public IP:** Enable
   - **Security group:** Create new
     - **Name:** `n8501645-api-sg`
     - **Rules:**
       - SSH (22) from My IP
       - HTTP (80) from Anywhere
       - HTTPS (443) from Anywhere
       - Custom TCP (8080) from Anywhere (for testing, will remove later)
7. **Advanced details:**
   - **IAM instance profile:** `LabRole` ⚠️ **IMPORTANT!**
8. Click **Launch instance**

### 3.2 Launch Worker Instance

1. Repeat steps above with these changes:
   - **Name:** `n8501645-worker`
   - **Security group:** Create new
     - **Name:** `n8501645-worker-sg`
     - **Rules:**
       - SSH (22) from My IP
   - **IAM instance profile:** `LabRole` ⚠️ **IMPORTANT!**
2. Click **Launch instance**

---

## 🛠️ Step 4: Set Up API Instance

### 4.1 Connect to API Instance

```bash
# Use Session Manager (easier, no key needed)
# OR SSH:
ssh -i your-key.pem ec2-user@<API_PUBLIC_IP>
```

### 4.2 Install Node.js 20

**For Amazon Linux 2023:**
```bash
sudo dnf install -y nodejs npm git
node -v  # Should be v18+
```

**For Ubuntu 22.04:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
node -v  # Should be v20+
```

### 4.3 Clone Repository

```bash
cd ~
git clone https://github.com/YOUR_USERNAME/Assignment_1.git
cd Assignment_1
```

### 4.4 Install Dependencies

```bash
npm install
```

### 4.5 Create `.env` File

⚠️ **NO AWS CREDENTIALS NEEDED** (IAM role handles this!)

```bash
nano .env
```

Paste:
```env
PORT=8080
NODE_ENV=production

# AWS Config (no credentials needed with IAM role!)
AWS_REGION=ap-southeast-2
S3_BUCKET=n8501645-a2
DDB_TABLE=n8501645-meetings
QUT_USERNAME=n8501645
SQS_QUEUE_URL=https://sqs.ap-southeast-2.amazonaws.com/901444280953/n8501645-job-queue

# Cognito
COGNITO_USER_POOL_ID=ap-southeast-2_9tnsroRRj
COGNITO_CLIENT_ID=YOUR_CLIENT_ID

# Secrets Manager
OPENAI_SECRET_NAME=a2-n8501645

# SSM Parameter Store
API_BASE_URL_PARAM=/wbr/api_base_url
API_BASE_URL=http://<API_PUBLIC_IP>:8080

# No ffmpeg path needed (will install system-wide)
```

**Save:** `CTRL+O`, `Enter`, `CTRL+X`

### 4.6 Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

### 4.7 Start API Service

```bash
pm2 start npm --name "wbr-api" -- run dev
pm2 save
pm2 startup  # Follow the command it outputs
```

### 4.8 Check Logs

```bash
pm2 logs wbr-api
```

You should see:
```
✅ SQS service initialized
WBR Actionizer server running on port 8080
OpenAI: Will fetch from Secrets Manager "a2-n8501645"
Stateless mode: ✅
```

---

## 🛠️ Step 5: Set Up Worker Instance

### 5.1 Connect to Worker Instance

```bash
ssh -i your-key.pem ec2-user@<WORKER_PUBLIC_IP>
```

### 5.2 Install Node.js 20 + ffmpeg

**For Amazon Linux 2023:**
```bash
sudo dnf install -y nodejs npm git
sudo dnf install -y ffmpeg
ffmpeg -version  # Verify installation
```

**For Ubuntu 22.04:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git ffmpeg
ffmpeg -version  # Verify installation
```

### 5.3 Clone Repository

```bash
cd ~
git clone https://github.com/YOUR_USERNAME/Assignment_1.git
cd Assignment_1/worker
```

### 5.4 Install Dependencies

```bash
npm install
```

### 5.5 Create `.env` File

```bash
nano .env
```

Paste:
```env
# AWS Config (no credentials needed with IAM role!)
AWS_REGION=ap-southeast-2
S3_BUCKET=n8501645-a2
DDB_TABLE=n8501645-meetings
QUT_USERNAME=n8501645
SQS_QUEUE_URL=https://sqs.ap-southeast-2.amazonaws.com/901444280953/n8501645-job-queue

# ffmpeg path (system-wide installation)
FFMPEG_PATH=/usr/bin/ffmpeg
```

**Save:** `CTRL+O`, `Enter`, `CTRL+X`

### 5.6 Install PM2

```bash
sudo npm install -g pm2
```

### 5.7 Start Worker Service

```bash
cd ~/Assignment_1/worker
pm2 start npm --name "wbr-worker" -- run dev
pm2 save
pm2 startup  # Follow the command it outputs
```

### 5.8 Check Logs

```bash
pm2 logs wbr-worker
```

You should see:
```
🚀 Worker worker-12345 started
📊 Polling SQS queue: https://sqs.ap-southeast-2.amazonaws.com/...
⏱️  Poll interval: 5000ms
```

---

## ✅ Step 6: Test the System

### 6.1 Access Frontend

1. Open browser: `http://<API_PUBLIC_IP>:8080`
2. Login with your Cognito user
3. Upload a video
4. Click "Transcode"

### 6.2 Monitor Logs

**On API instance:**
```bash
pm2 logs wbr-api
```

**On Worker instance:**
```bash
pm2 logs wbr-worker
```

You should see:
```
API logs:
📤 Published transcode job to SQS: <meeting_id>

Worker logs:
📨 Received 1 message(s) from SQS
🎬 Processing transcode job for meeting <meeting_id>
📥 Downloading from S3: ...
🎬 Running ffmpeg transcode...
✅ Transcode completed
```

### 6.3 Verify Results

1. Check DynamoDB: Meeting status should be "completed"
2. Check S3: Renditions (480p.mp4, 720p.mp4, audio.mp3) should exist

---

## 🎯 Next Steps

Once both services are working:

1. ✅ **Create Launch Template** from Worker instance
2. ✅ **Create Auto Scaling Group** (min: 1, max: 3)
3. ✅ **Configure Target Tracking Policy** (SQS queue depth)
4. ✅ **Test Auto Scaling** (upload 10-20 videos, watch 1→3→1)
5. ✅ **Set up ALB + HTTPS**

---

## 🔧 Troubleshooting

### IAM Role Not Working

**Check if role is attached:**
```bash
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/
```

Should return: `LabRole`

**If empty:** Re-attach IAM role via EC2 Console → Actions → Security → Modify IAM role → Select `LabRole`

### ffmpeg Not Found

```bash
which ffmpeg  # Should return /usr/bin/ffmpeg
ffmpeg -version  # Should show version
```

**If not installed:**
```bash
sudo dnf install -y ffmpeg  # Amazon Linux
# OR
sudo apt-get install -y ffmpeg  # Ubuntu
```

### Worker Not Polling SQS

**Check logs:**
```bash
pm2 logs wbr-worker --lines 50
```

**Look for:**
- ✅ "SQS client initialized"
- ✅ "Polling SQS queue"
- ❌ "ExpiredToken" → IAM role not attached
- ❌ "AccessDenied" → IAM policy missing SQS permissions

---

## 📝 Summary

- ✅ IAM role eliminates credential expiration issues
- ✅ API and Worker run on separate EC2 instances
- ✅ PM2 ensures services restart on crash/reboot
- ✅ Ready for Auto Scaling Group creation

**Time estimate:** 1-2 hours for full setup

