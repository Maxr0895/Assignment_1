Overview

Name: Max Reinhardt

Student number: n8501645

Application name: WBR Actionizer

Two line description: This app lets users upload Weekly Business Review meeting recordings, transcodes them to multiple formats, transcribes the audio (with OpenAI or manual fallback), and extracts action items for reporting. Users interact with the system through both a REST API and a simple web client.

Core criteria
Containerise the app

ECR Repository name: nXXXXXXX-wbr-actionizer

Video timestamp: mm:ss

Relevant files:

/Dockerfile

Deploy the container

EC2 instance ID: i-n8501645_assignment1

Video timestamp: mm:ss

User login

One line description: Hard-coded users (admin/editor/viewer) authenticated with JWTs.

Video timestamp: mm:ss

Relevant files:

/src/routes/auth.ts

/src/middleware/auth.ts

REST API

One line description: REST API exposing noun-based resources (/meetings, /reports) with GET/POST methods and appropriate status codes.

Video timestamp: mm:ss

Relevant files:

/src/routes/meetings.ts

/src/routes/processing.ts

/src/routes/reports.ts

Two kinds of data
First kind

One line description: Meeting recordings, transcoded renditions, thumbnails, and captions files.

Type: Unstructured

Rationale: Large binary files are best stored directly on disk.

Video timestamp: mm:ss

Relevant files:

/data/meetings/<uuid>/input.mp4

/src/services/ffmpegService.ts

Second kind

One line description: Metadata for meetings, renditions, captions, and extracted actions.

Type: Structured (SQLite, no strict ACID requirements).

Rationale: Required for queries, pagination, and ownership checks.

Video timestamp: mm:ss

Relevant files:

/src/services/db.ts

/src/models/schema.sql

CPU intensive task

One line description: Uses ffmpeg to transcode uploaded meeting recordings into 1080p and 720p renditions, extract audio, and generate thumbnails.

Video timestamp: mm:ss

Relevant files:

/src/services/ffmpegService.ts

/src/routes/processing.ts

CPU load testing

One line description: Python script repeatedly calls the /transcode endpoint to load CPU >80% for 5 minutes.

Video timestamp: mm:ss

Relevant files:

/scripts/loadtest_transcode.py

Additional criteria
Extensive REST API features

One line description: Implements versioning (/v1), pagination, filtering, and sorting on /meetings and /reports.

Video timestamp: mm:ss

Relevant files:

/src/routes/meetings.ts

/src/middleware/pagination.ts

External API(s)

One line description: Uses the OpenAI API for transcription and action-item extraction (JSON mode).

Video timestamp: mm:ss

Relevant files:

/src/services/openaiService.ts

/src/routes/processing.ts

Additional kinds of data

One line description: Generates subtitle files (.srt, .vtt) alongside transcripts, and stores JSON segments of transcript text.

Video timestamp: mm:ss

Relevant files:

/src/routes/processing.ts

/src/models/schema.sql

Custom processing

One line description: Provides rule-based action item extraction (regex) when OpenAI is unavailable, ensuring robust functionality.

Video timestamp: mm:ss

Relevant files:

/src/services/actionsFallback.ts

Web client

One line description: A static HTML/JS frontend served from /public to exercise all API endpoints (login, upload, transcode, transcribe, extract actions, reports).

Video timestamp: mm:ss

Relevant files:

/public/index.html

/public/app.js

/public/styles.css