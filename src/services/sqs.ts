import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand, Message } from '@aws-sdk/client-sqs';
import { config } from '../config';

/**
 * SQS Service for job queue management
 * 
 * This service handles:
 * - Publishing transcode jobs to SQS
 * - Receiving jobs from SQS (for workers)
 * - Deleting processed jobs
 */

const sqsClient = new SQSClient({ region: config.awsRegion });

export interface TranscodeJob {
  meetingId: string;
  userId: string;
  requestedAt: string;
}

export class SQSService {
  private queueUrl: string;

  constructor(queueUrl: string) {
    if (!queueUrl) {
      throw new Error('SQS_QUEUE_URL is required');
    }
    this.queueUrl = queueUrl;
  }

  /**
   * Publish a transcode job to the queue
   * @param job - Job details
   * @returns Message ID
   */
  async publishTranscodeJob(job: TranscodeJob): Promise<string> {
    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(job),
      MessageAttributes: {
        jobType: {
          DataType: 'String',
          StringValue: 'transcode'
        },
        meetingId: {
          DataType: 'String',
          StringValue: job.meetingId
        }
      }
    });

    const response = await sqsClient.send(command);
    
    if (!response.MessageId) {
      throw new Error('Failed to publish message to SQS');
    }

    console.log(`📤 Published transcode job to SQS: ${job.meetingId} (MessageId: ${response.MessageId})`);
    return response.MessageId;
  }

  /**
   * Receive messages from the queue (for workers)
   * @param maxMessages - Maximum number of messages to receive (1-10)
   * @param waitTimeSeconds - Long polling wait time (0-20)
   * @returns Array of messages
   */
  async receiveMessages(maxMessages: number = 1, waitTimeSeconds: number = 20): Promise<Message[]> {
    const command = new ReceiveMessageCommand({
      QueueUrl: this.queueUrl,
      MaxNumberOfMessages: maxMessages,
      WaitTimeSeconds: waitTimeSeconds,
      MessageAttributeNames: ['All'],
      VisibilityTimeout: 300 // 5 minutes to process
    });

    const response = await sqsClient.send(command);
    return response.Messages || [];
  }

  /**
   * Delete a message from the queue (after successful processing)
   * @param receiptHandle - Receipt handle from received message
   */
  async deleteMessage(receiptHandle: string): Promise<void> {
    const command = new DeleteMessageCommand({
      QueueUrl: this.queueUrl,
      ReceiptHandle: receiptHandle
    });

    await sqsClient.send(command);
    console.log(`✅ Deleted message from SQS`);
  }

  /**
   * Parse a transcode job from a message
   * @param message - SQS message
   * @returns Parsed job or null if invalid
   */
  parseTranscodeJob(message: Message): TranscodeJob | null {
    try {
      if (!message.Body) {
        console.error('❌ Message has no body');
        return null;
      }

      const job = JSON.parse(message.Body) as TranscodeJob;

      // Validate required fields
      if (!job.meetingId || !job.userId || !job.requestedAt) {
        console.error('❌ Invalid job format:', job);
        return null;
      }

      return job;
    } catch (error) {
      console.error('❌ Failed to parse job:', error);
      return null;
    }
  }
}

// Export singleton instance (will be initialized with queue URL from config)
// Note: This will be initialized in server.ts after config is loaded
let sqsServiceInstance: SQSService | null = null;

export function initSQSService(queueUrl: string): SQSService {
  sqsServiceInstance = new SQSService(queueUrl);
  return sqsServiceInstance;
}

export function getSQSService(): SQSService {
  if (!sqsServiceInstance) {
    throw new Error('SQS service not initialized. Call initSQSService() first.');
  }
  return sqsServiceInstance;
}

