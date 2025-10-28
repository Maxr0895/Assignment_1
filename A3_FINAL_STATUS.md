# 🎓 Assignment 3 - Final Status Report

**Student:** Max Rein - n8501645  
**Date:** October 28, 2025  
**Status:** Core Criteria Complete (8/10 marks)

---

## ✅ COMPLETED CRITERIA

### 1. **Microservices (3 marks)** ✅

**Implementation:**
- **API Service**: EC2 t2.micro @ 3.26.150.18:5000
  - Handles HTTP requests, uploads, authentication
  - Submits jobs to SQS
  - Source: `src/server.ts`, `src/routes/`, `src/services/`

- **Worker Service**: EC2 t2.micro in Auto Scaling Group
  - Polls SQS for transcode jobs
  - Processes videos with FFmpeg
  - Source: `worker/index.ts`, `worker/ffmpegService.ts`

**Evidence:** Video 1 (2 minutes)

---

### 2. **Load Distribution (2 marks)** ✅

**Implementation:**
- **SQS Queue**: `n8501645-job-queue`
- **Queue URL**: https://sqs.ap-southeast-2.amazonaws.com/901444280953/n8501645-job-queue
- **Mechanism**: Each message delivered to exactly one worker
- **Files**: `src/services/sqsService.ts`, `worker/sqsService.ts`

**Evidence:** Video 2 (0:20-0:40)

---

### 3. **Auto Scaling (3 marks)** ✅

**Implementation:**
- **ASG Name**: `wbr-worker-asg-n8501645`
- **Configuration**: Min=1, Max=3, Desired=Dynamic
- **Scaling Policies**:
  - `scale-out`: Add 2 instances when queue depth ≥ 5 messages
  - `scale-in`: Remove 2 instances when queue depth ≤ 1 message
- **CloudWatch Alarms**:
  - `scale-up-queue-depth-n8501645`
  - `scale-down-queue-depth-n8501645`
- **Metric**: ApproximateNumberOfMessagesVisible (SQS queue depth)

**Demonstrated:** 1 instance → 3 instances → 1 instance with no service interruption

**Evidence:** Video 2 (0:40-2:30)

---

## ❌ SKIPPED CRITERIA

### 4. **HTTPS (2 marks)** ❌

**Status:** Not implemented  
**Impact:** -2 marks  
**Reason:** Time constraints, focused on other core criteria first

**Would require:**
- Route 53 subdomain (already exists from A2)
- ACM certificate request
- Application Load Balancer with HTTPS listener
- Update DNS CNAME record

---

## 📊 MARKS BREAKDOWN

| Criterion | Marks | Status |
|-----------|-------|--------|
| Microservices | 3/3 | ✅ Complete |
| Load Distribution | 2/2 | ✅ Complete |
| Auto Scaling | 3/3 | ✅ Complete |
| HTTPS | 0/2 | ❌ Skipped |
| **TOTAL** | **8/10** | **80%** |

---

## 🎥 VIDEO EVIDENCE

### **Video 1: Microservices** (~2 minutes)
**Content:**
- Show API EC2 instance running PM2
- Show Worker EC2 instance running PM2
- Demonstrate both services working together
- API accepts upload, Worker processes it

**Key Points:**
- Two separate services
- Different EC2 instances
- Appropriate separation (API vs processing)

---

### **Video 2: Load Distribution + Auto Scaling** (~2.5 minutes)
**Content:**
- Show SQS queue monitoring (Monitoring tab)
- Show Auto Scaling Group (1 instance initially)
- Show scaling policies (`scale-out`, `scale-in`)
- Show CloudWatch alarms (both alarms)
- Upload videos to create load
- Show ASG scaling to 3 instances (Activity tab)
- Show worker logs processing jobs
- Show ASG scaling back to 1 instance

**Key Points:**
- SQS distributes load
- CloudWatch alarms trigger scaling
- Automatic scale up (1→3)
- Automatic scale down (3→1)
- No service interruption

---

## 🏗️ ARCHITECTURE SUMMARY

```
User → API (EC2) → SQS Queue → Workers (EC2 ASG 1-3)
                ↓                      ↓
              DynamoDB              S3 Bucket
                                  FFmpeg Transcode
```

**AWS Services Used:**
- EC2 (API + Workers)
- Auto Scaling Group
- SQS
- CloudWatch (Alarms)
- S3
- DynamoDB
- Secrets Manager
- Systems Manager Parameter Store
- IAM (Roles)
- Cognito (Auth)

---

## 📝 DOCUMENTATION

**Completed Files:**
- ✅ `CAB432_A3_Report_Template.md` - Full report with all details
- ✅ `VIDEO_2_SIMPLE_SCRIPT.md` - Video 2 script
- ✅ `VIDEO_2_QUICK_REFERENCE.md` - Video 2 checklist
- ✅ `CLOUDWATCH_AUTOSCALING_SETUP.md` - Setup instructions
- ✅ `A3_MICROSERVICES_SETUP.md` - Microservices deployment
- ✅ `A3_EC2_DEPLOYMENT.md` - EC2 setup guide

**Source Code:**
- ✅ `src/` - API service code
- ✅ `worker/` - Worker service code
- ✅ `public/` - Frontend HTML/CSS/JS

---

## 💰 COST ESTIMATE

**Monthly Running Costs:**
- EC2: ~$21.25/month (API + 1.5 workers average)
- S3: ~$0.24/month
- DynamoDB: ~$1.25/month
- CloudWatch: ~$0.20/month (2 alarms)
- Secrets Manager: ~$0.40/month
- Other: Free tier (SQS, SSM, Cognito)

**Total: ~$23.34/month**

---

## ✨ ACHIEVEMENTS

1. ✅ **Fully functional microservices architecture**
2. ✅ **Automatic scaling with CloudWatch alarms**
3. ✅ **Custom scaling metric (SQS queue depth)**
4. ✅ **No service interruption during scaling**
5. ✅ **Complete video evidence**
6. ✅ **Detailed documentation**
7. ✅ **Cost-effective implementation**

---

## 🚀 WHAT'S WORKING

- API accepts video uploads at http://3.26.150.18:5000
- Workers automatically process transcode jobs
- Auto Scaling responds to queue depth
- Videos stored in S3 bucket `a2-n8501645`
- Metadata stored in DynamoDB table `a2-n8501645`
- Cognito authentication functional
- OpenAI integration working (via Secrets Manager)

---

## 🎯 SUBMISSION CHECKLIST

- ✅ Report completed: `CAB432_A3_Report_Template.md`
- ✅ Video 1 recorded: Microservices
- ✅ Video 2 recorded: Load Distribution + Auto Scaling
- ✅ Code committed to repository
- ✅ AWS resources still running
- ✅ Application accessible for marking
- ⚠️ Add AWS Cost Calculator link to report (optional)

---

## 📌 IMPORTANT NOTES FOR MARKER

1. **API Endpoint**: http://3.26.150.18:5000
2. **No HTTPS**: Application uses HTTP only (skipped HTTPS criterion)
3. **SQS Queue**: `n8501645-job-queue` in ap-southeast-2
4. **ASG**: `wbr-worker-asg-n8501645` (scales 1-3 instances)
5. **CloudWatch Alarms**: Check `scale-up-queue-depth-n8501645` and `scale-down-queue-depth-n8501645`
6. **Scaling Metric**: Using SQS queue depth (more appropriate than CPU for batch jobs)

---

## 🎓 FINAL ASSESSMENT

**Expected Grade: 8/10 (80%)** - High Distinction range

**Strengths:**
- ✅ Solid microservices implementation
- ✅ Effective load distribution with SQS
- ✅ Proper auto-scaling with custom metric
- ✅ Good documentation and video evidence

**Weaknesses:**
- ❌ Missing HTTPS implementation (-2 marks)

**Overall:** Strong submission demonstrating core cloud architecture concepts with excellent auto-scaling implementation using appropriate metrics.

---

**Submission ready! Good luck! 🎉**

