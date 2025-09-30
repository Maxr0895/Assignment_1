# Assignment 2: AWS Deployment Setup Guide

Quick setup guide for deploying WBR Actionizer with S3 + DynamoDB.

---

## 🎯 Prerequisites

- AWS Account with access to ap-southeast-2 region
- AWS CLI configured
- Node.js 20+ installed
- QUT student email (for partition key)

---

## 📦 Step 1: Install Dependencies

```bash
npm install
```

This will install the new AWS SDK packages:
- `@aws-sdk/client-s3`
- `@aws-sdk/s3-request-presigner`
- `@aws-sdk/client-dynamodb`
- `@aws-sdk/lib-dynamodb`

---

## 🪣 Step 2: Create S3 Bucket

```bash
# Replace YOUR_NAME with your identifier (e.g., n12345678)
export BUCKET_NAME="wbr-actionizer-YOUR_NAME"

# Create bucket
aws s3 mb s3://$BUCKET_NAME --region ap-southeast-2

# Verify
aws s3 ls | grep wbr-actionizer
```

**Important:** Keep the bucket name for your `.env` file!

---

## 🗄️ Step 3: Create DynamoDB Table

```bash
# Replace YOUR_NAME with your identifier
export TABLE_NAME="wbr-actionizer-YOUR_NAME"

# Create table
aws dynamodb create-table \
  --table-name $TABLE_NAME \
  --attribute-definitions \
    AttributeName=qut-username,AttributeType=S \
    AttributeName=sk,AttributeType=S \
  --key-schema \
    AttributeName=qut-username,KeyType=HASH \
    AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region ap-southeast-2

# Verify
aws dynamodb describe-table --table-name $TABLE_NAME --region ap-southeast-2 --query 'Table.TableStatus'
```

**Expected output:** `"ACTIVE"`

**Important:** Keep the table name for your `.env` file!

---

## 🔐 Step 4: Create IAM Policy & Role (For EC2)

### 4a. Create IAM Policy

Create `wbr-policy.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3Access",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    },
    {
      "Sid": "DynamoDBAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem"
      ],
      "Resource": "arn:aws:dynamodb:ap-southeast-2:*:table/YOUR_TABLE_NAME"
    }
  ]
}
```

**Replace:** `YOUR_BUCKET_NAME` and `YOUR_TABLE_NAME` with your actual names!

### 4b. Create Policy in AWS

```bash
aws iam create-policy \
  --policy-name WBRActionizerPolicy \
  --policy-document file://wbr-policy.json
```

**Note the ARN** - you'll need it for the role!

### 4c. Create IAM Role (for EC2)

```bash
# Create trust policy
cat > trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ec2.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create role
aws iam create-role \
  --role-name WBRActionizerRole \
  --assume-role-policy-document file://trust-policy.json

# Attach policy (replace with your policy ARN)
aws iam attach-role-policy \
  --role-name WBRActionizerRole \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/WBRActionizerPolicy

# Create instance profile
aws iam create-instance-profile \
  --instance-profile-name WBRActionizerProfile

# Add role to instance profile
aws iam add-role-to-instance-profile \
  --instance-profile-name WBRActionizerProfile \
  --role-name WBRActionizerRole
```

---

## ⚙️ Step 5: Configure Environment Variables

Copy the example file:
```bash
cp env.example .env
```

Edit `.env`:
```bash
PORT=8080
JWT_SECRET=your_secure_jwt_secret_here

# AWS Configuration (REQUIRED!)
AWS_REGION=ap-southeast-2
S3_BUCKET=wbr-actionizer-YOUR_NAME
DDB_TABLE=wbr-actionizer-YOUR_NAME
QUT_USERNAME=n12345678@qut.edu.au  # Use YOUR QUT email!

# Optional
OPENAI_API_KEY=your_openai_api_key  # For transcription
FFMPEG_PATH=/usr/bin/ffmpeg
```

**Important:**
- Use your actual S3 bucket name
- Use your actual DynamoDB table name
- Use your actual QUT email (must end with @qut.edu.au)

---

## 🚀 Step 6: Deploy to EC2

### 6a. Launch EC2 Instance

1. Go to AWS Console → EC2 → Launch Instance
2. **Name:** `wbr-actionizer`
3. **AMI:** Ubuntu Server 24.04 LTS
4. **Instance type:** t3.small (minimum - t2.micro is too small)
5. **Key pair:** Create/select your key pair
6. **Network:** Default VPC, Auto-assign public IP: **Enable**
7. **IAM instance profile:** Select `WBRActionizerProfile` ✅
8. **Security group:**
   - SSH (22) - Your IP
   - Custom TCP (8080) - 0.0.0.0/0
9. **Storage:** 20GB gp3
10. Launch!

### 6b. Connect to EC2

```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_IP
```

### 6c. Install Node.js & Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install ffmpeg
sudo apt install -y ffmpeg

# Verify
node --version  # Should be v20.x
ffmpeg -version  # Should show version
```

### 6d. Deploy Application

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/Assignment_1.git
cd Assignment_1

# Install dependencies
npm install

# Create .env file
nano .env
# Paste your configuration (from Step 5)

# Build TypeScript
npm run build

# Start with PM2
sudo npm install -g pm2
pm2 start npm --name wbr-actionizer -- start
pm2 save
pm2 startup
```

---

## ✅ Step 7: Test the Application

### 7a. Test Health Endpoint
```bash
curl http://YOUR_EC2_IP:8080/health
```

**Expected:**
```json
{
  "status": "healthy",
  "timestamp": "2025-09-30T...",
  "openaiAvailable": true
}
```

### 7b. Test Upload
```bash
# Create test user (one-time)
curl -X POST http://YOUR_EC2_IP:8080/v1/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin","role":"admin"}'

# Login
TOKEN=$(curl -s -X POST http://YOUR_EC2_IP:8080/v1/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  | jq -r '.token')

# Upload video
curl -X POST http://YOUR_EC2_IP:8080/v1/meetings \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-video.mp4" \
  -F "title=Test Meeting"
```

### 7c. Check S3
```bash
aws s3 ls s3://YOUR_BUCKET_NAME/meetings/ --recursive
```

**Expected:** You should see `meetings/<uuid>/input.<ext>`

### 7d. Check DynamoDB
```bash
aws dynamodb scan \
  --table-name YOUR_TABLE_NAME \
  --region ap-southeast-2
```

**Expected:** You should see a MEETING# item

---

## 🔍 Troubleshooting

### Issue: "AWS_REGION environment variable is required"
**Fix:** Make sure `.env` file exists and has AWS_REGION set

### Issue: "AccessDenied" when uploading to S3
**Fix:** Verify IAM role is attached to EC2 instance
```bash
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/
```
Should return role name.

### Issue: "ResourceNotFoundException" for DynamoDB
**Fix:** Verify table exists and name matches
```bash
aws dynamodb list-tables --region ap-southeast-2
```

### Issue: App won't start
**Check logs:**
```bash
pm2 logs wbr-actionizer
```

**Common fixes:**
- Install dependencies: `npm install`
- Check `.env` file exists and is valid
- Verify Node.js version: `node --version` (must be 20+)

---

## 📊 Verify Everything Works

Complete workflow test:

1. **Upload** video → Check S3 for input file
2. **Transcode** → Check S3 for renditions
3. **Transcribe** → Check S3 for captions
4. **Extract actions** → Check DynamoDB for actions
5. **Generate report** → Should show action statistics

---

## 🧹 Cleanup (After Testing)

```bash
# Delete S3 bucket contents
aws s3 rm s3://YOUR_BUCKET_NAME --recursive

# Delete S3 bucket
aws s3 rb s3://YOUR_BUCKET_NAME

# Delete DynamoDB table
aws dynamodb delete-table \
  --table-name YOUR_TABLE_NAME \
  --region ap-southeast-2

# Terminate EC2 instance (from AWS Console)

# Delete IAM resources
aws iam remove-role-from-instance-profile \
  --instance-profile-name WBRActionizerProfile \
  --role-name WBRActionizerRole

aws iam delete-instance-profile \
  --instance-profile-name WBRActionizerProfile

aws iam detach-role-policy \
  --role-name WBRActionizerRole \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/WBRActionizerPolicy

aws iam delete-role --role-name WBRActionizerRole

aws iam delete-policy \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/WBRActionizerPolicy
```

---

## 📝 Checklist

- [ ] S3 bucket created
- [ ] DynamoDB table created (with correct schema)
- [ ] IAM policy created
- [ ] IAM role created and attached to EC2
- [ ] EC2 instance launched with IAM profile
- [ ] Security group allows port 8080
- [ ] Node.js 20+ installed on EC2
- [ ] ffmpeg installed on EC2
- [ ] `.env` file configured with correct values
- [ ] Application running on EC2
- [ ] Health check passes
- [ ] Video upload works
- [ ] S3 objects created
- [ ] DynamoDB items created
- [ ] Presigned URLs work

---

## 🎓 Learning Objectives Achieved

✅ S3 for object storage (stateless)  
✅ DynamoDB for metadata (NoSQL)  
✅ IAM roles for secure access  
✅ Presigned URLs for private objects  
✅ EC2 deployment with instance profile  
✅ Single-table design in DynamoDB  
✅ Stateless application architecture  

---

## 📚 Additional Resources

- [S3 Developer Guide](https://docs.aws.amazon.com/s3/)
- [DynamoDB Developer Guide](https://docs.aws.amazon.com/dynamodb/)
- [IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [EC2 User Guide](https://docs.aws.amazon.com/ec2/)
