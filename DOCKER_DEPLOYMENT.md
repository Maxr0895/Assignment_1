# Docker Deployment Guide for WBR Actionizer

This guide follows the Docker practical and deploys the WBR Actionizer using Docker containers.

## Prerequisites

- EC2 Instance running Ubuntu LTS 24.04
- SSH access to EC2 instance
- Public DNS: `ec2-13-236-121-131.ap-southeast-2.compute.amazonaws.com`

---

## Part 1: Install Docker on EC2

### Step 1: Connect to EC2

```bash
ssh -i /path/to/your-key.pem ubuntu@ec2-13-236-121-131.ap-southeast-2.compute.amazonaws.com
```

### Step 2: Switch to ubuntu user (if using Session Manager)

```bash
sudo su -l ubuntu
cd ~
```

### Step 3: Install Docker

```bash
# Download Docker installation script
curl -fsSL https://get.docker.com -o get-docker.sh

# Run installation script
sudo sh ./get-docker.sh

# Add ubuntu user to docker group
sudo adduser ubuntu docker

# Re-login to apply group changes
sudo su -l ubuntu

# Verify installation
docker --version
docker info
```

### Step 4: Test Docker with Hello World

```bash
# Run hello-world container
docker run hello-world

# List all containers
docker container ls -a

# Remove the hello-world container (get the ID from ls -a)
docker container rm <container_id>
```

---

## Part 2: Deploy WBR Actionizer with Docker

### Step 1: Clone Your Repository

```bash
cd ~
git clone https://github.com/Maxr0895/Assignment_1.git
cd Assignment_1
```

### Step 2: Create Environment File

Create a `.env` file with your configuration:

```bash
nano .env
```

Add this content (replace with your actual OpenAI key):

```
PORT=8080
JWT_SECRET=your_production_jwt_secret
OPENAI_API_KEY=your_openai_api_key_here
FFMPEG_PATH=/usr/bin/ffmpeg
```

Save: `CTRL+X` → `Y` → `Enter`

### Step 3: Build Docker Image

```bash
# Build the image (this takes 2-3 minutes)
docker build -t wbr-actionizer .

# Verify image was created
docker images
```

### Step 4: Run the Container

**Option A - Simple run:**

```bash
docker run -d \
  --name wbr-actionizer \
  -p 8080:8080 \
  --env-file .env \
  -v $(pwd)/data:/data \
  wbr-actionizer
```

**Option B - With Docker Compose (recommended):**

Use the provided `docker-compose.yml` file:

```bash
docker-compose up -d
```

### Step 5: Verify Container is Running

```bash
# Check container status
docker ps

# View logs
docker logs wbr-actionizer

# Follow logs (CTRL+C to exit)
docker logs -f wbr-actionizer

# Check health
curl http://localhost:8080/health
```

---

## Part 3: Configure EC2 Security Group

**⚠️ IMPORTANT:** Open port 8080 in AWS Console

1. AWS Console → EC2 → Instances
2. Select your instance → Security tab
3. Click Security Group → Edit Inbound Rules → Add Rule:
   - **Type:** Custom TCP
   - **Port:** 8080
   - **Source:** 0.0.0.0/0
4. Save rules

---

## Part 4: Access Your Application

Open browser to:

```
http://ec2-13-236-121-131.ap-southeast-2.compute.amazonaws.com:8080
```

**Login credentials:**
- Username: `admin`
- Password: `admin`

---

## Docker Commands Reference

### Container Management

```bash
# Start container
docker start wbr-actionizer

# Stop container
docker stop wbr-actionizer

# Restart container
docker restart wbr-actionizer

# Remove container
docker rm wbr-actionizer

# View logs
docker logs wbr-actionizer

# Execute command in container
docker exec -it wbr-actionizer bash
```

### Image Management

```bash
# List images
docker images

# Remove image
docker rmi wbr-actionizer

# Rebuild image
docker build -t wbr-actionizer .
```

### System Cleanup

```bash
# Remove stopped containers
docker container prune

# Remove unused images
docker image prune

# Remove all unused resources
docker system prune -a
```

---

## Updating Your Application

When you update code on GitHub:

```bash
# Pull latest code
cd ~/Assignment_1
git pull

# Rebuild image
docker build -t wbr-actionizer .

# Stop and remove old container
docker stop wbr-actionizer
docker rm wbr-actionizer

# Run new container
docker run -d \
  --name wbr-actionizer \
  -p 8080:8080 \
  --env-file .env \
  -v $(pwd)/data:/data \
  wbr-actionizer
```

Or with Docker Compose:

```bash
git pull
docker-compose up -d --build
```

---

## Troubleshooting

### Container won't start
```bash
docker logs wbr-actionizer
```

### Can't access on port 8080
- Check Security Group rules
- Verify container is running: `docker ps`
- Check port binding: `docker port wbr-actionizer`

### Database issues
```bash
# Shell into container
docker exec -it wbr-actionizer bash

# Inside container, seed database
npm run seed
exit
```

### Out of disk space
```bash
# Clean up Docker resources
docker system prune -a
```

---

## Environment Variables with Docker

Following the practical's Step 5 & 6:

**Method 1 - CLI flags:**
```bash
docker run -it -e unit=CAB432 --rm ubuntu bash -c "printenv"
```

**Method 2 - .env file (recommended):**
```bash
docker run -it --env-file .env --rm ubuntu bash -c "printenv"
```

Your application uses Method 2 with the `--env-file .env` flag.

---

## Next Steps

1. ✅ Install Docker on EC2
2. ✅ Clone repository
3. ✅ Create `.env` file
4. ✅ Build Docker image
5. ✅ Run container
6. ✅ Open port 8080
7. ✅ Access application

**Your containerized WBR Actionizer is now running! 🐳**
