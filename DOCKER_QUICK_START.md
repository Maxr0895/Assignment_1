# Docker Quick Start - WBR Actionizer

Following your Docker practical, here's how to deploy the WBR Actionizer using Docker.

## 🎯 Your EC2 Instance
**Public DNS:** `ec2-13-236-121-131.ap-southeast-2.compute.amazonaws.com`

---

## 🚀 Quick Deployment (3 Steps)

### 1. Connect to EC2

```bash
ssh -i /path/to/your-key.pem ubuntu@ec2-13-236-121-131.ap-southeast-2.compute.amazonaws.com
```

### 2. Clone & Deploy

```bash
# Clone repository
cd ~
git clone https://github.com/Maxr0895/Assignment_1.git
cd Assignment_1

# Run automated Docker deployment
chmod +x deploy-docker.sh
./deploy-docker.sh
```

### 3. Configure & Access

**Edit .env file:**
```bash
nano .env
```

Replace `OPENAI_API_KEY=your_openai_api_key_here` with your actual key, then:

```bash
docker-compose restart
```

**Access app:**
```
http://ec2-13-236-121-131.ap-southeast-2.compute.amazonaws.com:8080
```

Login: `admin` / `admin`

---

## 📚 How This Relates to Your Practical

### Practical Step 1: Install Docker ✅
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh ./get-docker.sh
sudo adduser ubuntu docker
sudo su -l ubuntu
```

**Automated in:** `deploy-docker.sh`

### Practical Step 2: Test Hello World ✅
```bash
docker run hello-world
```

**Your app equivalent:**
```bash
docker run -p 8080:8080 wbr-actionizer
```

### Practical Step 3: Remove Container ✅
```bash
docker container ls -a
docker container rm <id>
```

**Your app:**
```bash
docker-compose down
```

### Practical Step 4: Ubuntu Image ✅
```bash
docker run -it --rm ubuntu bash
```

**Your app uses:** `node:20-slim` base image (see Dockerfile)

### Practical Step 5: Environment Variables (CLI) ✅
```bash
docker run -it -e unit=CAB432 --rm ubuntu bash -c "printenv"
```

**Your app uses:**
```bash
docker run -p 8080:8080 -e PORT=8080 -e JWT_SECRET=secret wbr-actionizer
```

### Practical Step 6: Environment Variables (File) ✅
```bash
# Create .env file
cat > .env << EOF
unit=CAB432
name=Cloud Computing
uni=QUT
EOF

# Use it
docker run -it --env-file .env --rm ubuntu bash -c "printenv"
```

**Your app uses:**
```bash
docker run -p 8080:8080 --env-file .env wbr-actionizer
# OR
docker-compose up -d  # Uses .env automatically
```

---

## 🐳 Docker Commands for Your App

### Basic Operations

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Restart
docker-compose restart

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

### Advanced Operations

```bash
# Rebuild image
docker-compose build --no-cache

# Shell into container
docker exec -it wbr-actionizer bash

# View environment variables
docker exec wbr-actionizer printenv

# Seed database
docker exec wbr-actionizer npm run seed
```

### Debugging

```bash
# View all logs
docker-compose logs

# Follow logs
docker-compose logs -f

# Check health
curl http://localhost:8080/health

# Inspect container
docker inspect wbr-actionizer
```

---

## 📦 What's in the Docker Container?

Your `Dockerfile` creates a container with:

1. ✅ **Node.js 20** (base image)
2. ✅ **ffmpeg** (video processing)
3. ✅ **Python 3** (for scripts)
4. ✅ **Your app code** (WBR Actionizer)
5. ✅ **All dependencies** (from package.json)
6. ✅ **Built TypeScript** (compiled to JavaScript)

The container:
- Listens on port **8080**
- Stores data in **/data** volume
- Auto-restarts if it crashes
- Has health checks every 30s

---

## 🔧 Troubleshooting

### Container won't start
```bash
docker-compose logs
```

### Can't access on port 8080
1. Check Security Group (AWS Console)
2. Verify container: `docker ps`
3. Check port: `docker port wbr-actionizer`

### API key not working
```bash
# Check .env is loaded
docker exec wbr-actionizer printenv | grep OPENAI

# Edit .env
nano .env

# Restart
docker-compose restart
```

### Database issues
```bash
docker exec -it wbr-actionizer bash
npm run seed
exit
```

---

## 📁 Files Created for You

1. **`Dockerfile`** - Defines how to build the image
2. **`docker-compose.yml`** - Orchestrates containers
3. **`deploy-docker.sh`** - Automated deployment script
4. **`DOCKER_DEPLOYMENT.md`** - Full deployment guide
5. **`DOCKER_QUICK_START.md`** - This file!

---

## ✅ Deployment Checklist

- [ ] Docker installed on EC2
- [ ] Repository cloned
- [ ] `.env` file created with API key
- [ ] Docker image built
- [ ] Container running (`docker ps`)
- [ ] Port 8080 open in Security Group
- [ ] App accessible via browser
- [ ] Login works (admin/admin)

---

**Need help?** Check `DOCKER_DEPLOYMENT.md` for detailed steps!
