---
title: "CAB432 Project Report - Assignment 3"
author:
- "Max Reinhardt - n8501645"
---

# Application overview

WBR Actionizer is a cloud-based video transcoding application that allows users to upload videos, which are then automatically transcoded to web-optimized formats using FFmpeg. The application uses a microservices architecture with separate API and Worker services, distributes workload through SQS queuing, and automatically scales worker instances based on demand. Videos and metadata are stored in S3 and DynamoDB respectively, with OpenAI integration for generating video summaries and action items.

# Application architecture

## AWS Services Used:

- **EC2**: Hosts the API server (port 5000) and Worker instances for video transcoding
- **S3**: Stores uploaded videos, transcoded output files, and thumbnails (bucket: `a2-n8501645`)
- **DynamoDB**: Stores video metadata, job status, and processing results (table: `a2-n8501645`)
- **SQS**: Message queue for distributing transcode jobs to worker instances (queue: `n8501645-job-queue`)
- **Auto Scaling Group**: Automatically scales worker instances between 1-3 based on SQS queue depth
- **CloudWatch**: Monitors SQS queue metrics and triggers scaling alarms
- **Secrets Manager**: Stores OpenAI API key securely (secret: `a2-n8501645`)
- **Systems Manager Parameter Store**: Stores API base URL configuration
- **IAM**: Manages EC2 instance roles for AWS service access
- **Cognito**: Handles user authentication (User Pool ID: `ap-southeast-2_9tnsroRRj`)


## Project Core - Microservices

- **First service functionality:** Public-facing REST API server - handles HTTP requests, user uploads, authentication, and job submission to SQS
- **First service compute:** EC2 t2.micro instance (IP: 3.26.150.18, Port: 5000)
- **First service source files:**
  - `src/server.ts` - Main API server
  - `src/routes/` - API endpoints (auth, meetings, processing, reports)
  - `src/middleware/auth.ts` - Authentication middleware
  - `src/services/` - Business logic (S3, DynamoDB, SQS, OpenAI services)
  - `public/` - Frontend HTML/CSS/JS

- **Second service functionality:** Worker service - processes transcode jobs from SQS queue, performs video transcoding with FFmpeg
- **Second service compute:** EC2 t2.micro instances in Auto Scaling Group (wbr-worker-asg-n8501645)
- **Second service source files:**
  - `worker/index.ts` - Worker main process
  - `worker/ffmpegService.ts` - FFmpeg transcoding logic
  - `worker/sqsService.ts` - SQS message polling and processing

- **Video timestamp:** Video 1 - Microservices demonstration (0:00-2:00)


## Project Additional - Additional microservices

- **Status:** Not implemented (core criteria only)
- **Video timestamp:** N/A


## Project Additional - Serverless functions

- **Status:** Not implemented (core criteria only)
- **Video timestamp:** N/A


## Project Additional - Container orchestration with ECS 

- **Status:** Not implemented (core criteria only)
- **Video timestamp:** N/A


## Project Core - Load distribution

- **Load distribution mechanism:** Amazon SQS (Simple Queue Service) - FIFO-style message delivery ensures each transcode job is processed by exactly one worker
- **Mechanism instance name:** `n8501645-job-queue` (Queue URL: https://sqs.ap-southeast-2.amazonaws.com/901444280953/n8501645-job-queue)
- **Video timestamp:** Video 2 - Load Distribution & Auto Scaling (0:20-0:40)
- **Relevant files:**
    - `src/services/sqsService.ts` - API sends jobs to queue
    - `worker/sqsService.ts` - Workers poll and process jobs
    - `src/routes/processing.ts` - Transcode endpoint that submits jobs


## Project Additional - Communication mechanisms

- **Status:** Not implemented as additional criterion (SQS already used for core load distribution)
- **Video timestamp:** N/A


## Project Core - Autoscaling

- **EC2 Auto-scale group name:** `wbr-worker-asg-n8501645`
- **Configuration:** Min: 1, Max: 3, Desired: 1 (dynamically adjusted)
- **Scaling policies:**
  - **scale-out**: Step scaling policy - adds 2 instances when SQS queue depth ≥ 5 messages (triggered by CloudWatch alarm `scale-up-queue-depth-n8501645`)
  - **scale-in**: Step scaling policy - removes 2 instances when SQS queue depth ≤ 1 message (triggered by CloudWatch alarm `scale-down-queue-depth-n8501645`)
- **Scaling metric:** ApproximateNumberOfMessagesVisible (SQS queue depth) - custom metric, more appropriate than CPU for batch job processing
- **Video timestamp:** Video 2 - Load Distribution & Auto Scaling (0:40-2:30)
- **Relevant files:**
    - Launch Template: Created from working worker EC2 instance
    - CloudWatch Alarms: `scale-up-queue-depth-n8501645`, `scale-down-queue-depth-n8501645`


## Project Additional - Custom scaling metric

- **Description of metric:** SQS ApproximateNumberOfMessagesVisible (queue depth)
- **Implementation:** CloudWatch built-in metric for SQS, monitored by custom alarms triggering step scaling policies
- **Rationale:** Queue depth is more appropriate than CPU utilization for batch processing workloads because:
  - **Small scale (1-5 jobs):** Single worker can handle, queue stays near zero, no scaling needed
  - **Large scale (10+ jobs):** Queue builds up, triggers scale-out to 3 workers, processes jobs in parallel, then scales back down
  - CPU-based scaling doesn't work well for FFmpeg transcoding as it maxes out quickly even with light load
- **Video timestamp:** Video 2 - Auto Scaling configuration (0:50-1:10)
- **Relevant files:**
    - CloudWatch Alarms: `scale-up-queue-depth-n8501645`, `scale-down-queue-depth-n8501645`
    - ASG Scaling Policies: `scale-out`, `scale-in`


## Project Core - HTTPS

- **Status:** Not implemented (skipped for this submission)
- **Current access:** HTTP only via IP address (http://3.26.150.18:5000)
- **Domain name:** N/A
- **Certificate ID:** N/A
- **ALB/API Gateway name:** N/A
- **Video timestamp:** N/A
- **Relevant files:** N/A


## Project Additional - Container orchestration features

- **Status:** Not implemented (core criteria only)
- **Video timestamp:** N/A


## Project Additional - Infrastructure as Code

- **Status:** Not implemented (core criteria only)
- **Video timestamp:** N/A


## Project Additional - Dead letter queue

- **Status:** Not implemented (core criteria only)
- **Video timestamp:** N/A


## Project Additional - Edge Caching

- **Status:** Not implemented (core criteria only)
- **Video timestamp:** N/A


## Project Additional - Other (with prior permission only)

- **Status:** Not applicable
- **Video timestamp:** N/A


# Cost estimate

**AWS Cost Calculator Link:** [To be added]

**Estimated Monthly Costs:**
- **EC2**: 
  - API instance (t2.micro): ~$8.50/month (730 hours)
  - Worker instances (t2.micro, avg 1.5 instances): ~$12.75/month
  - **Subtotal EC2**: ~$21.25/month
- **S3**: 
  - Storage (10GB): ~$0.23/month
  - Requests (1000 PUT, 5000 GET): ~$0.01/month
  - **Subtotal S3**: ~$0.24/month
- **DynamoDB**: 
  - On-demand pricing, estimated 1M requests: ~$1.25/month
- **SQS**: 
  - Standard queue, estimated 10K requests: ~$0.00/month (free tier)
- **CloudWatch**: 
  - 2 alarms: ~$0.20/month
  - Metrics: Free tier
- **Secrets Manager**: 
  - 1 secret: ~$0.40/month
- **Systems Manager Parameter Store**: Free tier
- **Cognito**: Free tier (up to 50,000 MAUs)

**Total Estimated Monthly Cost: ~$23.34/month**

# Scaling up

The application is designed to scale horizontally by adding more worker instances. The Auto Scaling Group can be configured to scale beyond 3 instances by adjusting the maximum capacity. For larger workloads:

1. **Worker scaling**: Increase ASG max from 3 to 10+ instances
2. **API scaling**: Add Application Load Balancer with multiple API instances
3. **Database scaling**: DynamoDB auto-scales with on-demand pricing
4. **Queue capacity**: SQS has no practical limit on message throughput
5. **Storage**: S3 scales automatically

The current architecture supports processing hundreds of videos concurrently with minimal code changes.

# Security

**Security measures implemented:**
- **Authentication**: AWS Cognito for user authentication and JWT tokens
- **IAM Roles**: EC2 instances use IAM roles instead of hardcoded credentials
- **Secrets Management**: OpenAI API key stored in AWS Secrets Manager
- **Network Security**: Security groups restrict traffic (only ports 22, 5000, 8080 open)
- **Data Encryption**: S3 encryption at rest, HTTPS for AWS API calls
- **Stateless Design**: No session data stored on servers, fully JWT-based auth

**Future improvements:**
- Add HTTPS with ACM certificate and ALB
- Implement CloudWatch logs encryption
- Add VPC with private subnets for worker instances
- Implement S3 bucket policies with principle of least privilege

# Sustainability

**Current sustainability considerations:**
- **Auto-scaling**: Workers scale down to 1 instance when idle, minimizing resource waste
- **Right-sizing**: Using t2.micro instances (smallest practical size for Node.js + FFmpeg)
- **On-demand resources**: DynamoDB and S3 only charged for actual usage
- **Efficient processing**: Jobs processed in batches, workers shut down when queue is empty

**Carbon footprint:**
- Estimated 1.5 EC2 instances running average = ~11 kgCO2e/month (based on AWS sustainability data)
- AWS ap-southeast-2 region uses some renewable energy
- Minimal data transfer reduces network carbon impact

**Future improvements:**
- Use AWS Graviton (ARM) instances for better power efficiency
- Implement video caching in CloudFront to reduce transcoding redundancy
- Add dead letter queue to avoid retrying failed jobs unnecessarily
- Schedule non-urgent transcodes for off-peak hours when grid is greener

# Bibliography

- AWS Documentation: EC2 Auto Scaling - https://docs.aws.amazon.com/autoscaling/ec2/
- AWS Documentation: SQS - https://docs.aws.amazon.com/sqs/
- AWS Documentation: CloudWatch Alarms - https://docs.aws.amazon.com/cloudwatch/
- FFmpeg Documentation - https://ffmpeg.org/documentation.html
- Node.js AWS SDK v3 - https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/

