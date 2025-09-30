# Deploy WBR Actionizer to EC2

## Your EC2 Details
- **Public DNS:** `ec2-13-236-121-131.ap-southeast-2.compute.amazonaws.com`
- **Region:** ap-southeast-2 (Sydney)

## Step 1: Connect to Your EC2 Instance

### Using SSH (Recommended)
```bash
# Make sure you have your .pem key file
ssh -i /path/to/your-key.pem ubuntu@ec2-13-236-121-131.ap-southeast-2.compute.amazonaws.com
```

### Using Session Manager (Alternative)
If you don't have the key file, use AWS Session Manager from the AWS console.

---

## Step 2: Install Node.js on EC2

Once connected to your EC2 instance, run these commands:

```bash
# Switch to ubuntu user if needed
sudo su -l ubuntu

# Install Node.js (using NVM for latest version)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install --lts
node --version  # Should show v20.x or similar
```

---

## Step 3: Install System Dependencies

Your project needs **ffmpeg** for video processing:

```bash
# Update package manager
sudo apt-get update

# Install ffmpeg
sudo apt-get install -y ffmpeg

# Verify installation
ffmpeg -version
```

---

## Step 4: Upload Your Project to EC2

### Option A: Using Git (Recommended)
```bash
# If your project is on GitHub
cd ~
git clone YOUR_GITHUB_REPO_URL
cd Assignment_1

# Or if it's private:
git clone https://YOUR_TOKEN@github.com/YOUR_USERNAME/Assignment_1.git
```

### Option B: Using SCP (From Your Local Machine)
```bash
# Run this from your LOCAL machine (not EC2)
scp -i /path/to/your-key.pem -r C:\Users\maxrein\Assignment_1 ubuntu@ec2-13-236-121-131.ap-southeast-2.compute.amazonaws.com:~/
```

---

## Step 5: Set Up Environment Variables

```bash
# Navigate to project directory
cd ~/Assignment_1

# Create .env file
nano .env
```

**Add this content to .env:**
```
PORT=8080
JWT_SECRET=your_production_jwt_secret_here
OPENAI_API_KEY=your_openai_api_key_here
FFMPEG_PATH=/usr/bin/ffmpeg
```

**⚠️ Replace `your_openai_api_key_here` with your actual OpenAI API key!**

**Save:** Press `CTRL+X`, then `Y`, then `Enter`

---

## Step 6: Install Project Dependencies

```bash
# Install Node.js packages
npm install

# If you get build errors with better-sqlite3:
sudo apt-get install -y build-essential python3
npm rebuild better-sqlite3
```

---

## Step 7: Set Up Database

```bash
# Create data directory
mkdir -p data

# Seed the database with default users
npm run seed
```

---

## Step 8: Configure EC2 Security Group

**⚠️ IMPORTANT:** You need to allow HTTP traffic on port 8080!

1. Go to **AWS Console** → **EC2** → **Instances**
2. Select your instance
3. Click **Security** tab
4. Click on the **Security Group** name
5. Click **Edit inbound rules**
6. Click **Add rule**:
   - **Type:** Custom TCP
   - **Port:** 8080
   - **Source:** Anywhere-IPv4 (0.0.0.0/0)
7. Click **Save rules**

---

## Step 9: Run the Application

### Option A: Run in Foreground (Testing)
```bash
npm run dev
```

### Option B: Run in Background (Production)
```bash
# Install PM2 (process manager)
npm install -g pm2

# Start the app with PM2
pm2 start npm --name "wbr-actionizer" -- run dev

# Make it auto-start on reboot
pm2 startup
pm2 save
```

---

## Step 10: Access Your Application

Open your browser and go to:

```
http://ec2-13-236-121-131.ap-southeast-2.compute.amazonaws.com:8080
```

**Login with:**
- Username: `admin`
- Password: `admin`

---

## Useful Commands

### Check if server is running:
```bash
curl http://localhost:8080/health
```

### View logs (if using PM2):
```bash
pm2 logs wbr-actionizer
```

### Restart server (if using PM2):
```bash
pm2 restart wbr-actionizer
```

### Stop server:
```bash
# If running in foreground: CTRL+C
# If using PM2:
pm2 stop wbr-actionizer
```

---

## Troubleshooting

### Can't connect to port 8080?
- Check security group rules (Step 8)
- Verify server is running: `pm2 status` or `ps aux | grep node`

### ffmpeg not working?
- Check path: `which ffmpeg`
- Update .env: `FFMPEG_PATH=/usr/bin/ffmpeg`

### Database errors?
- Recreate: `rm -rf data && mkdir data && npm run seed`

### Out of memory?
- EC2 t2.micro only has 1GB RAM
- Consider upgrading to t2.small or t3.small
