# WBR Actionizer

A production-ready REST API for Weekly Business Review action item extraction from video meetings. Features CPU-intensive video transcoding, optional OpenAI integration, and comprehensive reporting capabilities.

## Features

- **REST API**: Full CRUD operations with JWT authentication and role-based access
- **Video Processing**: CPU-intensive transcoding with ffmpeg (multiple resolutions, thumbnails, audio extraction)
- **AI Integration**: Optional OpenAI transcription and action item extraction with fallbacks
- **Data Storage**: SQLite for structured data, file system for media assets
- **Load Testing**: Python script for stress testing CPU-intensive operations
- **Docker Ready**: Containerized deployment with all dependencies

## Quick Start

### Local Development

1. **Install dependencies**:

```bash
npm install
```

2. **Set up environment**:

```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Initialize database and seed users**:

```bash
npm run initdb
npm run seed
```

4. **Start development server**:

```bash
npm run dev
```

The application will be available at `http://localhost:8080`.

### Default Users

After seeding, you can login with:

- `admin/admin` (full access)
- `editor/editor` (can upload and process)
- `viewer/viewer` (read-only access)

## API Endpoints

### Authentication

- `POST /v1/login` - Login with username/password, returns JWT token

### Meetings

- `POST /v1/meetings` - Upload new meeting video (multipart form)
- `GET /v1/meetings` - List meetings with pagination/filtering
- `GET /v1/meetings/:id` - Get detailed meeting information

### Processing

- `POST /v1/meetings/:id/transcode` - CPU-intensive video transcoding
- `POST /v1/meetings/:id/transcribe` - Generate transcript (OpenAI or manual)
- `POST /v1/meetings/:id/actions` - Extract action items

### Reports

- `GET /v1/reports/wbr-summary` - Weekly business review summary with filters

### Example API Usage

```bash
# Login
curl -X POST http://localhost:8080/v1/login \
  -H "Content-Type: application/json" \
  -d '{"username":"editor","password":"editor"}'

# Upload meeting (use the JWT token from login)
curl -X POST http://localhost:8080/v1/meetings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@meeting.mp4" \
  -F "title=Weekly Team Meeting"

# Transcode video (CPU intensive)
curl -X POST http://localhost:8080/v1/meetings/MEETING_ID/transcode \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Generate transcript
curl -X POST http://localhost:8080/v1/meetings/MEETING_ID/transcribe \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"manualTranscript":"Meeting transcript text..."}'

# Extract actions
curl -X POST http://localhost:8080/v1/meetings/MEETING_ID/actions \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Docker Deployment

### Build and Run

```bash
# Build the Docker image
docker build -t wbr-actionizer .

# Run the container
docker run -d \
  -p 8080:8080 \
  -v $(pwd)/data:/data \
  -e JWT_SECRET=your_secret_here \
  -e OPENAI_API_KEY=your_openai_key \
  --name wbr-actionizer \
  wbr-actionizer
```

### AWS ECR & EC2 Deployment

1. **Push to ECR**:

```bash
# Create ECR repository
aws ecr create-repository --repository-name wbr-actionizer

# Get login token
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com

# Tag and push
docker tag wbr-actionizer:latest YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/wbr-actionizer:latest
docker push YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/wbr-actionizer:latest
```

2. **Deploy to EC2**:

```bash
# On EC2 instance
docker pull YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/wbr-actionizer:latest
docker run -d -p 80:8080 \
  -v /opt/wbr-data:/data \
  -e JWT_SECRET=production_secret \
  -e OPENAI_API_KEY=your_key \
  YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/wbr-actionizer:latest
```

## Load Testing

The included Python script stress tests the CPU-intensive transcoding endpoint:

```bash
# Install dependencies
pip3 install httpx

# First, get a JWT token and upload some meetings
# Then run the load test
python3 scripts/loadtest_transcode.py \
  --base-url http://localhost:8080 \
  --jwt YOUR_JWT_TOKEN \
  --ids "meeting-id-1,meeting-id-2,meeting-id-3" \
  --concurrency 10 \
  --repeat 5
```

This will generate 200-300 concurrent transcode requests to keep EC2 CPU above 80% for 5+ minutes.

Monitor CPU usage with:

```bash
# On EC2
top
# Or use CloudWatch metrics
```

## Project Structure

```
/public/              # Static web client
  index.html         # Main UI
  styles.css         # Styling
  app.js            # Frontend logic
/src/
  server.ts         # Express server setup
  config.ts         # Configuration management
  routes/           # API route handlers
    auth.ts         # Authentication endpoints
    meetings.ts     # Meeting CRUD operations
    processing.ts   # Video processing endpoints
    reports.ts      # Reporting endpoints
  middleware/
    auth.ts         # JWT authentication middleware
  services/
    db.ts           # SQLite database service
    ffmpegService.ts # Video transcoding service
    openaiService.ts # OpenAI integration
    actionsFallback.ts # Rule-based action extraction
  models/
    schema.sql      # Database schema
    seed.ts         # Database seeding
/scripts/
  loadtest_transcode.py # Load testing script
/data/               # Data directory (gitignored)
  app.db            # SQLite database
  meetings/         # Meeting files organized by UUID
```

## Configuration

### Required Environment Variables

- `PORT`: Server port (default: 8080)
- `JWT_SECRET`: Secret for JWT token signing (required)

### Optional Environment Variables

- `OPENAI_API_KEY`: Enable AI-powered transcription and action extraction

## Data Storage

### Structured Data (SQLite)

- Users, meetings metadata, renditions, captions, actions
- Single file database at `/data/app.db`

### Unstructured Data (File System)

Each meeting stored under `/data/meetings/<uuid>/`:

- `input.mp4` - Original uploaded video
- `out_1080p.mp4`, `out_720p.mp4` - Transcoded renditions
- `audio.wav` - Extracted audio for transcription
- `thumbs_*.jpg` - Generated thumbnails (every 2 seconds)
- `captions.srt`, `captions.vtt` - Caption files

## Architecture Decisions

- **Single Process**: No queues or microservices for simplicity
- **File Storage**: Local file system (easily adaptable to S3)
- **CPU Intensive**: Intentionally uses slow ffmpeg presets for load testing
- **Optional AI**: Graceful fallbacks when OpenAI is unavailable
- **Same Origin**: Frontend served by Express to avoid CORS complexity

## Performance Notes

The transcoding process is intentionally CPU-intensive using `ffmpeg -preset veryslow` to generate load for performance testing. In production, you might want to use faster presets for better user experience.

## Environment Variables

Create a `.env` file in the project root based on the following example:

```
PORT=8080
JWT_SECRET=change_me

# Optional external APIs
OPENAI_API_KEY=
# Optional custom data directory (defaults to ./data)
DATA_DIR=
```
