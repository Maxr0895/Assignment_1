import dotenv from 'dotenv';
import path from 'path';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, Message } from '@aws-sdk/client-sqs';
import { TranscodeProcessor, TranscodeJob } from './processor';

// Load environment variables from worker/.env
// Use process.cwd() to get current working directory (works with ts-node-dev)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Worker Configuration
 */
interface WorkerConfig {
  workerId: string;
  awsRegion: string;
  sqsQueueUrl: string;
  s3Bucket: string;
  ddbTable: string;
  qutUsername: string;
  ffmpegPath: string;
  pollIntervalMs: number;
  maxMessagesPerPoll: number;
}

function loadConfig(): WorkerConfig {
  const workerId = process.env.WORKER_ID || `worker-${process.pid}`;
  const awsRegion = process.env.AWS_REGION;
  const sqsQueueUrl = process.env.SQS_QUEUE_URL;
  const s3Bucket = process.env.S3_BUCKET;
  const ddbTable = process.env.DDB_TABLE;
  const qutUsername = process.env.QUT_USERNAME;
  const ffmpegPath = process.env.FFMPEG_PATH || '/usr/bin/ffmpeg';
  const pollIntervalMs = parseInt(process.env.POLL_INTERVAL_MS || '5000');
  const maxMessagesPerPoll = parseInt(process.env.MAX_MESSAGES_PER_POLL || '1');

  if (!awsRegion) throw new Error('AWS_REGION is required');
  if (!sqsQueueUrl) throw new Error('SQS_QUEUE_URL is required');
  if (!s3Bucket) throw new Error('S3_BUCKET is required');
  if (!ddbTable) throw new Error('DDB_TABLE is required');
  if (!qutUsername) throw new Error('QUT_USERNAME is required');

  return {
    workerId,
    awsRegion,
    sqsQueueUrl,
    s3Bucket,
    ddbTable,
    qutUsername,
    ffmpegPath,
    pollIntervalMs,
    maxMessagesPerPoll
  };
}

/**
 * Worker Class
 * Polls SQS for transcode jobs and processes them
 */
class TranscodeWorker {
  private config: WorkerConfig;
  private sqsClient: SQSClient;
  private processor: TranscodeProcessor;
  private isRunning: boolean = false;
  private currentJobCount: number = 0;

  constructor(config: WorkerConfig) {
    this.config = config;
    this.sqsClient = new SQSClient({ region: config.awsRegion });
    this.processor = new TranscodeProcessor({
      awsRegion: config.awsRegion,
      s3Bucket: config.s3Bucket,
      ddbTable: config.ddbTable,
      qutUsername: config.qutUsername,
      ffmpegPath: config.ffmpegPath
    });
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    this.isRunning = true;
    console.log(`🚀 Worker ${this.config.workerId} started`);
    console.log(`📊 Polling SQS queue: ${this.config.sqsQueueUrl}`);
    console.log(`⏱️  Poll interval: ${this.config.pollIntervalMs}ms`);
    console.log(`📦 Max messages per poll: ${this.config.maxMessagesPerPoll}`);

    // Start polling loop
    this.poll();
  }

  /**
   * Stop the worker
   */
  stop(): void {
    this.isRunning = false;
    console.log(`🛑 Worker ${this.config.workerId} stopping...`);
  }

  /**
   * Poll SQS for messages
   */
  private async poll(): Promise<void> {
    while (this.isRunning) {
      try {
        // Receive messages from SQS
        const command = new ReceiveMessageCommand({
          QueueUrl: this.config.sqsQueueUrl,
          MaxNumberOfMessages: this.config.maxMessagesPerPoll,
          WaitTimeSeconds: 20, // Long polling
          MessageAttributeNames: ['All'],
          VisibilityTimeout: 300 // 5 minutes to process
        });

        const response = await this.sqsClient.send(command);
        const messages = response.Messages || [];

        if (messages.length === 0) {
          console.log(`💤 No messages in queue, waiting ${this.config.pollIntervalMs}ms...`);
          await this.sleep(this.config.pollIntervalMs);
          continue;
        }

        console.log(`📨 Received ${messages.length} message(s) from SQS`);

        // Process each message
        for (const message of messages) {
          await this.processMessage(message);
        }
      } catch (error) {
        console.error(`❌ Error polling SQS:`, error);
        await this.sleep(this.config.pollIntervalMs);
      }
    }

    console.log(`✅ Worker ${this.config.workerId} stopped`);
  }

  /**
   * Process a single SQS message
   */
  private async processMessage(message: Message): Promise<void> {
    const receiptHandle = message.ReceiptHandle;
    if (!receiptHandle) {
      console.error(`❌ Message has no receipt handle, skipping`);
      return;
    }

    try {
      // Parse job from message body
      const job = this.parseJob(message);
      if (!job) {
        console.error(`❌ Failed to parse job, deleting message`);
        await this.deleteMessage(receiptHandle);
        return;
      }

      console.log(`🎬 Processing transcode job for meeting ${job.meetingId}`);
      this.currentJobCount++;

      // Process the job
      await this.processor.processJob(job);

      // Delete message from queue (job completed successfully)
      await this.deleteMessage(receiptHandle);
      console.log(`✅ Job completed for meeting ${job.meetingId}`);
    } catch (error) {
      console.error(`❌ Failed to process message:`, error);
      // Don't delete the message - it will become visible again after visibility timeout
      // and can be retried or moved to DLQ
    } finally {
      this.currentJobCount--;
    }
  }

  /**
   * Parse transcode job from SQS message
   */
  private parseJob(message: Message): TranscodeJob | null {
    try {
      if (!message.Body) {
        console.error(`❌ Message has no body`);
        return null;
      }

      const job = JSON.parse(message.Body) as TranscodeJob;

      // Validate required fields
      if (!job.meetingId || !job.userId || !job.requestedAt) {
        console.error(`❌ Invalid job format:`, job);
        return null;
      }

      return job;
    } catch (error) {
      console.error(`❌ Failed to parse job:`, error);
      return null;
    }
  }

  /**
   * Delete message from SQS
   */
  private async deleteMessage(receiptHandle: string): Promise<void> {
    const command = new DeleteMessageCommand({
      QueueUrl: this.config.sqsQueueUrl,
      ReceiptHandle: receiptHandle
    });

    await this.sqsClient.send(command);
    console.log(`🗑️  Message deleted from SQS`);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current status
   */
  getStatus(): { workerId: string; isRunning: boolean; currentJobCount: number } {
    return {
      workerId: this.config.workerId,
      isRunning: this.isRunning,
      currentJobCount: this.currentJobCount
    };
  }
}

/**
 * Main entry point
 */
async function main() {
  try {
    const config = loadConfig();
    const worker = new TranscodeWorker(config);

    // Graceful shutdown handlers
    process.on('SIGTERM', () => {
      console.log('📡 SIGTERM received, shutting down gracefully...');
      worker.stop();
    });

    process.on('SIGINT', () => {
      console.log('📡 SIGINT received, shutting down gracefully...');
      worker.stop();
    });

    // Start the worker
    await worker.start();
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the worker
main();

