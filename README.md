# WBR Actionizer

Modern stateless Node.js/TypeScript API for managing Weekly Business Review meeting assets. Upload large video files directly to S3, track processing state in DynamoDB, drive media workflows (transcode, transcribe, extract actions) and secure the system end‑to‑end with AWS Cognito, Secrets Manager and Parameter Store. The entire stack is Docker ready and deployable to EC2.

---

## Quick Start

```bash
git clone <repo>
cd Assignment_1
npm install
cp env.example .env      # fill with your AWS + Cognito values
npm run dev              # launches http://localhost:8080
```

> Requires Node.js 20+, FFmpeg installed locally, and AWS Academy credentials with access to S3, DynamoDB, Cognito, Secrets Manager and SSM Parameter Store.


## Environment Variables

`env.example` documents every setting used across environments. Highlighted values:

| Variable | Purpose |
| --- | --- |
| `AWS_REGION` | Region for all AWS resources (`ap-southeast-2`). |
| `S3_BUCKET` | Bucket for meeting objects (`meetings/{uuid}/...`). |
| `DDB_TABLE` | DynamoDB table name (single-table design). |
| `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID` | Credentials for Cognito user pool. |
| `OPENAI_SECRET_NAME` | Secrets Manager secret with OpenAI key (falls back to `OPENAI_API_KEY` locally). |
| `API_BASE_URL_PARAM` | SSM Parameter storing public API base URL. |
| `FFMPEG_PATH` | Absolute FFmpeg path (Windows path in `.env` is already set up). |


## Features Overview

- **Direct S3 uploads** using presigned URLs (PUT) with progress reporting.
- **Stateless JWT authentication** via Cognito; no sessions, pure bearer tokens.
- **Role + MFA aware UI** – Admin/Users groups decide who can process jobs. Admin actions require TOTP enrollment and verification.
- **DynamoDB single-table design** tracks meetings, captions, renditions, actions and idempotency keys.
- **Idempotent processing routes** (custom `Idempotency-Key` header).
- **Server-Sent Events channel** for polling-free status updates with auto‑reconnect.
- **OpenAI Whisper + GPT integration** for transcripts and action extraction, with Secrets Manager based key retrieval.
- **Config bootstrap via SSM** so deployments always discover the canonical API base URL.
- **Docker + ECR friendly** pipeline for EC2 deployments.


## Running the Workflows

1. **Authenticate** via `/v1/login` (returns `accessToken`, `idToken`). Store the `idToken` client-side for API calls.
2. **Upload**: UI performs: presign (`/v1/files/presign-upload`) → PUT to S3 with progress → register meeting (`/v1/meetings`).
3. **Process** (admin only): trigger `/transcode`, `/transcribe`, `/actions` endpoints. Each creates temp dirs, downloads source from S3, performs ffmpeg/OpenAI work, writes artifacts back to S3/DynamoDB, then deletes temp files.
4. **Monitor** meeting detail page. SSE endpoint `/v1/meetings/:id/events` streams status updates and auto-resyncs state after disconnects.
5. **Delete** meetings via `DELETE /v1/meetings/:id` (owner or Admin). Removes all DynamoDB metadata while leaving S3 artifacts intact.


## Project Structure

```
src/
  server.ts                # Express bootstrap (CORS, routes, health)
  config.ts                # Env parsing + shared config
  routes/
    auth.ts                # Registration/Login/MFA setup
    meetings.ts            # Upload, list, detail, delete
    processing.ts          # Transcode/Transcribe/Actions
    files.ts               # Presigned upload/download URLs
    events.ts              # SSE endpoint
    reports.ts             # WBR summary API
    config.ts              # Public config (`apiBaseUrl`)
  middleware/auth.ts       # Cognito token verification + RBAC helpers
  services/
    ddb.ts                 # DynamoDB queries & idempotency logic
    s3.ts                  # S3 client + pre-signed helpers
    ffmpegService.ts       # Transcoding orchestration
    openaiService.ts       # Whisper/GPT calls (lazy init)
    secrets.ts             # Secrets Manager fetch + caching
    ssm.ts                 # Parameter Store fetch + caching
    cognitoAuth.ts         # Direct Cognito API operations
  utils/temp.ts            # Temp directory lifecycle helpers

public/
  index.html, app.js, styles.css # Browser UI with upload + admin dashboards

docs/
  (screenshots referenced in README sections)
```


## Key AWS Integrations

### S3 Bucket `a2-n8501645`
- Stores original uploads (`meetings/{uuid}/input.ext`), renditions, audio extracts, captions, thumbnails.
- Bucket CORS must allow PUT/GET from frontend origins and expose headers required for browser uploads.

### DynamoDB Table `a2-n8501645`
- Partition key: fixed QUT username. Sort key encodes entity type (e.g., `MEETING#uuid`).
- Additional sort key prefixes: `REND#`, `CAPTIONS#`, `ACTION#`, `IDEMP#` etc.
- Items include processing `status`, `lastUpdatedAt`, original filename, S3 prefixes and computed metadata.

### Cognito User Pool `a2-n8501645-users`
- SRP password auth or custom MFA flow (TOTP).
- Groups used for authorization: `Admin` (full processing + deletion rights) vs regular users (upload/view only).
- `/v1/me` surfaces current user profile, groups and MFA status for the frontend to react appropriately.

### AWS Secrets Manager & Parameter Store
- Secret `a2-n8501645` exposes the OpenAI API key with caching and retry logic.
- Parameter `/wbr/api_base_url` provides the canonical public API base URL. `/v1/config` returns this to clients.


## Deployment Notes

### Local / Dev
- Run `npm run dev` (ts-node-dev with transpile-only).
- `.env` contains Windows-friendly FFmpeg path and placeholder AWS credentials.
- Ensure AWS Academy credentials are refreshed frequently; failures like `ExpiredTokenException` mean you need fresh keys.

### Docker + EC2
- Build: `docker build -t wbr-actionizer .`
- Local run: `docker run -p 8080:8080 --env-file .env ...`
- For EC2, push image to ECR, assign IAM role granting S3/DynamoDB/Secrets/SSM access, then run container with appropriate env vars. Diagram + instructions in project docs (`DOCKER_DEPLOYMENT.md`).

### Health + Monitoring
- `/health` returns uptime + OpenAI availability.
- SSE logs (`📡` entries) surface connection lifecycle; repeated `getaddrinfo ENOENT` indicates expired AWS credentials or missing network access.


## Testing & Validation

- **Stateless verification**: kill server mid-job, restart container, resubmit; job resumes because all state is persisted. Idempotency keys prevent duplicates.
- **Role enforcement**: attempt processing routes with non-admin token → expect `403`.
- **MFA checks**: login without MFA as admin triggers warning banner + disabled buttons until TOTP enrollment is completed.
- **SSE**: observe console logs when killing server; banner `⚠️ Live updates disconnected, retrying...` appears and clears after reconnection.


## Housekeeping

- Single source of env documentation (`env.example`).
- All obsolete setup/test scripts removed.
- README trimmed to essentials; deep dives live in supporting docs:
  - `STATELESS_MIGRATION_SUMMARY.md`
  - `PRESIGNED_URLS_IMPLEMENTATION.md`
  - `SECRETS_MANAGER_IMPLEMENTATION.md`
  - `SSM_PARAMETER_STORE_IMPLEMENTATION.md`
  - `MFA_IMPLEMENTATION.md`
  - `SSE_IMPLEMENTATION.md`


## License

MIT

