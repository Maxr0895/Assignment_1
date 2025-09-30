#!/bin/bash
# Automated Docker deployment script for WBR Actionizer
# Run this on your EC2 instance after cloning the repository

set -e  # Exit on any error

echo "🐳 WBR Actionizer - Docker Deployment"
echo "======================================"
echo ""

# Step 1: Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "📦 Docker not found. Installing Docker..."
    
    # Download and run Docker installation script
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh ./get-docker.sh
    rm get-docker.sh
    
    # Add current user to docker group
    sudo usermod -aG docker $USER
    
    echo "✅ Docker installed!"
    echo "⚠️  You need to log out and back in for group changes to take effect"
    echo "⚠️  After re-login, run this script again"
    exit 0
fi

echo "✅ Docker is installed: $(docker --version)"
echo ""

# Step 2: Check if user is in docker group
if ! groups | grep -q docker; then
    echo "⚠️  User $USER is not in the docker group"
    echo "Adding to docker group..."
    sudo usermod -aG docker $USER
    echo "⚠️  Log out and back in, then run this script again"
    exit 0
fi

# Step 3: Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "📦 Installing Docker Compose..."
    sudo apt-get update -qq
    sudo apt-get install -y docker-compose
    echo "✅ Docker Compose installed!"
fi

echo "✅ Docker Compose: $(docker-compose --version)"
echo ""

# Step 4: Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << 'EOF'
PORT=8080
JWT_SECRET=production_jwt_secret_change_this
OPENAI_API_KEY=your_openai_api_key_here
FFMPEG_PATH=/usr/bin/ffmpeg
EOF
    echo "✅ .env file created"
    echo "⚠️  IMPORTANT: Edit .env and add your actual OpenAI API key!"
    echo "   Run: nano .env"
    echo ""
else
    echo "✅ .env file already exists"
fi

# Step 5: Stop existing container if running
if docker ps -a --format '{{.Names}}' | grep -q "^wbr-actionizer$"; then
    echo "🛑 Stopping existing container..."
    docker-compose down
fi

# Step 6: Build the Docker image
echo "🔨 Building Docker image (this may take 2-3 minutes)..."
docker-compose build

# Step 7: Start the container
echo "🚀 Starting container..."
docker-compose up -d

# Step 8: Wait for container to be healthy
echo "⏳ Waiting for application to start..."
sleep 5

# Step 9: Check container status
echo ""
echo "📊 Container Status:"
docker-compose ps

# Step 10: Show logs
echo ""
echo "📋 Recent logs:"
docker-compose logs --tail=20

# Step 11: Test health endpoint
echo ""
echo "🏥 Testing health endpoint..."
if curl -s http://localhost:8080/health > /dev/null; then
    echo "✅ Application is healthy!"
else
    echo "⚠️  Health check failed - check logs with: docker-compose logs"
fi

# Final instructions
echo ""
echo "✅ ========================================="
echo "✅  Docker Deployment Complete!"
echo "✅ ========================================="
echo ""
echo "📍 Your app is running at:"
echo "   http://ec2-13-236-121-131.ap-southeast-2.compute.amazonaws.com:8080"
echo ""
echo "🔐 Login credentials:"
echo "   Username: admin"
echo "   Password: admin"
echo ""
echo "📊 Useful commands:"
echo "   docker-compose ps          - Check status"
echo "   docker-compose logs -f     - View logs"
echo "   docker-compose restart     - Restart app"
echo "   docker-compose down        - Stop app"
echo "   docker-compose up -d       - Start app"
echo ""
echo "⚠️  IMPORTANT: Make sure port 8080 is open in your EC2 Security Group!"
echo ""

# Check if .env needs updating
if grep -q "your_openai_api_key_here" .env; then
    echo "⚠️  WARNING: .env still has placeholder API key!"
    echo "   Edit .env: nano .env"
    echo "   Then restart: docker-compose restart"
    echo ""
fi
