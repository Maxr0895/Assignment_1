#!/bin/bash
# Quick deployment script for EC2
# Run this ON your EC2 instance after uploading the project

set -e  # Exit on any error

echo "🚀 Starting WBR Actionizer Deployment..."

# 1. Install Node.js if not present
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install --lts
fi

echo "✅ Node.js version: $(node --version)"

# 2. Install system dependencies
echo "📦 Installing system dependencies..."
sudo apt-get update -qq
sudo apt-get install -y ffmpeg build-essential python3

echo "✅ ffmpeg installed: $(which ffmpeg)"

# 3. Install npm packages
echo "📦 Installing npm packages..."
npm install

# 4. Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << 'EOF'
PORT=8080
JWT_SECRET=production_jwt_secret_change_this
OPENAI_API_KEY=your_openai_api_key_here
FFMPEG_PATH=/usr/bin/ffmpeg
EOF
    echo "⚠️  IMPORTANT: Edit .env and add your actual OpenAI API key!"
    echo "✅ .env file created"
else
    echo "✅ .env file already exists"
fi

# 5. Set up database
echo "📊 Setting up database..."
mkdir -p data
npm run seed

# 6. Build TypeScript
echo "🔨 Building project..."
npm run build

# 7. Install PM2 if not present
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    npm install -g pm2
fi

# 8. Start the application
echo "🚀 Starting application with PM2..."
pm2 delete wbr-actionizer 2>/dev/null || true
pm2 start npm --name "wbr-actionizer" -- run dev
pm2 save

echo ""
echo "✅ ========================================="
echo "✅  Deployment Complete!"
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
echo "   pm2 status          - Check app status"
echo "   pm2 logs            - View logs"
echo "   pm2 restart all     - Restart app"
echo "   pm2 stop all        - Stop app"
echo ""
echo "⚠️  IMPORTANT: Make sure port 8080 is open in your EC2 Security Group!"
echo ""
