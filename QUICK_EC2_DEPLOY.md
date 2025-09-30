# Quick EC2 Deployment Guide

## 🎯 Your EC2 Instance
**Public DNS:** `ec2-13-236-121-131.ap-southeast-2.compute.amazonaws.com`

---

## Step 1: Open Port 8080 on EC2 ⚠️ CRITICAL

1. AWS Console → EC2 → Instances → Select your instance
2. Security tab → Click Security Group link
3. Edit Inbound Rules → Add Rule:
   - **Type:** Custom TCP
   - **Port:** 8080
   - **Source:** 0.0.0.0/0
4. Save rules

---

## Step 2: Connect to EC2

**Option A - SSH:**
```bash
ssh -i /path/to/your-key.pem ubuntu@ec2-13-236-121-131.ap-southeast-2.compute.amazonaws.com
```

**Option B - Session Manager:**
AWS Console → EC2 → Select instance → Connect → Session Manager

---

## Step 3: Deploy the Application

```bash
# Clone repository
cd ~
git clone https://github.com/Maxr0895/Assignment_1.git
cd Assignment_1

# Run automated deployment
chmod +x deploy-to-ec2.sh
./deploy-to-ec2.sh
```

---

## Step 4: Configure OpenAI API Key

The script creates a placeholder `.env` file. You need to add your actual API key:

```bash
# Edit .env file
nano .env
```

**Replace this line:**
```
OPENAI_API_KEY=your_openai_api_key_here
```

**With your actual key** (the one that starts with `sk-proj-...` from your OpenAI account)

Save: `CTRL+X` → `Y` → `Enter`

**Restart the server:**
```bash
pm2 restart wbr-actionizer
```

---

## Step 5: Access Your App

Open browser:
```
http://ec2-13-236-121-131.ap-southeast-2.compute.amazonaws.com:8080
```

**Login:**
- Username: `admin`
- Password: `admin`

---

## Useful Commands

```bash
# Check server status
pm2 status

# View logs
pm2 logs wbr-actionizer

# Restart server
pm2 restart wbr-actionizer

# Update code from GitHub
cd ~/Assignment_1
git pull
pm2 restart wbr-actionizer
```

---

## Troubleshooting

**Can't connect on port 8080?**
- Check Security Group has port 8080 open
- Verify server is running: `pm2 status`
- Check logs: `pm2 logs`

**OpenAI not working?**
- Verify API key in `.env` is correct
- Check logs: `pm2 logs | grep OpenAI`

**Need to stop the server?**
```bash
pm2 stop wbr-actionizer
```
