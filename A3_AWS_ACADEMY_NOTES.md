# AWS Academy Learner Lab - Important Notes

## 🔐 IAM Role Restrictions

### ❌ What You CANNOT Do
- Create custom IAM roles
- Create custom IAM policies
- Modify IAM permissions
- Create IAM users or groups

### ✅ What You CAN Do
- Use the pre-created **`LabRole`** for all EC2 instances
- `LabRole` already has permissions for:
  - ✅ S3 (read/write)
  - ✅ DynamoDB (CRUD operations)
  - ✅ SQS (send/receive/delete messages)
  - ✅ Secrets Manager (get secrets)
  - ✅ SSM Parameter Store (get parameters)
  - ✅ CloudWatch Logs (write logs)
  - ✅ EC2 (launch instances, modify security groups)

---

## 🚀 Updated Deployment Strategy

### Step 1: Verify LabRole
1. Go to **IAM Console** → **Roles**
2. Search for `LabRole`
3. Confirm it exists with `LabPolicy` attached

### Step 2: Launch EC2 Instances
When creating EC2 instances:
- **Advanced details** → **IAM instance profile** → Select `LabRole`
- **This eliminates the need for AWS credentials in `.env` files!**

### Step 3: Configure `.env` Files
Your `.env` files **DO NOT** need:
- ~~`AWS_ACCESS_KEY_ID`~~
- ~~`AWS_SECRET_ACCESS_KEY`~~
- ~~`AWS_SESSION_TOKEN`~~

The `LabRole` provides credentials automatically via EC2 instance metadata!

---

## ⏰ AWS Academy Session Limitations

### Session Duration
- **Learner Lab sessions expire after 4 hours**
- You'll see a countdown timer in the AWS Console
- When the session expires:
  - ❌ All EC2 instances are stopped (not terminated)
  - ❌ You cannot access AWS services
  - ✅ Your data in S3, DynamoDB, and SQS persists

### Starting a New Session
1. Go to AWS Academy → Modules → Learner Lab
2. Click **Start Lab**
3. Wait for the indicator to turn green (~1-2 minutes)
4. Click **AWS** to open the console
5. **Restart your EC2 instances:**
   - EC2 Console → Instances → Select stopped instances
   - Actions → Instance State → Start Instance

### Auto-Scaling During Session Expiration
⚠️ **Important:** If your session expires while Auto Scaling Group is active:
- ASG will be unable to launch new instances
- Existing instances will stop
- When you start a new session, manually start 1 instance to resume

---

## 🎯 Assignment 3 Considerations

### For the Demo Video
- **Record the entire demo in ONE AWS Academy session** (< 4 hours)
- OR: **Pause recording, start new session, restart instances, resume recording**

### For Auto Scaling Test
- Plan your load test to complete within session time
- Scaling from 1→3→1 takes ~15-30 minutes total
- Allow extra time for setup and verification

---

## 🔧 Checking LabRole on EC2

Once your EC2 instance is running, SSH in and verify LabRole is attached:

```bash
# Check if role is attached
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/
# Should return: LabRole

# Get temporary credentials (these are auto-rotated by AWS)
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/LabRole
```

If `LabRole` is attached, you'll see JSON output with temporary credentials. Your application will use these automatically via the AWS SDK!

---

## 📋 Pre-Deployment Checklist

- [x] ✅ **LabRole** exists (no custom role creation needed)
- [ ] Code pushed to GitHub
- [ ] Two EC2 instances launched with `LabRole` attached
- [ ] Services running and tested (upload, transcode, SQS)
- [ ] Launch Template created from working Worker instance
- [ ] Auto Scaling Group created (min: 1, max: 3)
- [ ] ALB + HTTPS configured
- [ ] Demo video recorded

---

## 🐛 Common Issues

### "ExpiredToken" errors
**Cause:** AWS Academy session expired  
**Solution:** Start new session, restart EC2 instances

### "AccessDenied" errors
**Cause:** LabRole not attached to EC2 instance  
**Solution:** EC2 Console → Actions → Security → Modify IAM role → Select `LabRole`

### Worker not processing jobs after session restart
**Cause:** pm2 processes may not auto-restart  
**Solution:**
```bash
ssh into worker instance
pm2 restart wbr-worker
pm2 logs wbr-worker
```

---

## 💡 Pro Tips

1. **Save your work frequently** - Session can expire unexpectedly
2. **Use Session Manager** instead of SSH - No key management needed
3. **Monitor session timer** - Visible in AWS Console top-right
4. **Create Launch Template early** - Easier to recreate instances if needed
5. **Test Auto Scaling quickly** - Don't wait until last minute
6. **Record demo in segments** - Easier to edit and reshoot if needed

---

## 📞 Support

- **AWS Academy Forums:** For Learner Lab issues
- **Unit Coordinator:** For assignment clarification
- **Deployment Guides:**
  - `A3_EC2_DEPLOYMENT.md` - Full deployment guide
  - `A3_QUICK_REFERENCE.md` - Quick commands reference
  - `A3_MICROSERVICES_SETUP.md` - Architecture overview

