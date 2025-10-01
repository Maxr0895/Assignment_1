import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config';
import { Readable } from 'stream';

// Initialize S3 client
const s3Client = new S3Client({
  region: config.awsRegion
});

export class S3Service {
  private bucket: string;

  constructor() {
    this.bucket = config.s3Bucket;
  }

  /**
   * Upload an object to S3
   * @param key - S3 object key (e.g., "meetings/uuid/input.mp4")
   * @param body - File content as Buffer, Uint8Array, or Readable stream
   * @param contentType - MIME type (optional)
   */
  async putObject(
    key: string,
    body: Buffer | Uint8Array | Readable,
    contentType?: string
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType
    });

    await s3Client.send(command);
    console.log(`✅ Uploaded to S3: s3://${this.bucket}/${key}`);
  }

  /**
   * Generate a presigned GET URL for an S3 object
   * @param key - S3 object key
   * @param expiresInSeconds - URL expiration time (default: 1 hour)
   * @returns Presigned URL string
   */
  async getPresignedGetUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key
    });

    const url = await getSignedUrl(s3Client, command, {
      expiresIn: expiresInSeconds
    });

    return url;
  }

  /**
   * Generate a presigned PUT URL for uploading directly to S3
   * @param key - S3 object key where the file will be stored
   * @param contentType - MIME type of the file to be uploaded
   * @param expiresInSeconds - URL expiration time (default: 15 minutes)
   * @returns Presigned URL string
   */
  async getPresignedPutUrl(
    key: string, 
    contentType: string, 
    expiresInSeconds = 900
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType
    });

    const url = await getSignedUrl(s3Client, command, {
      expiresIn: expiresInSeconds
    });

    return url;
  }

  /**
   * Delete an object from S3
   * @param key - S3 object key
   */
  async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key
    });

    await s3Client.send(command);
    console.log(`🗑️  Deleted from S3: s3://${this.bucket}/${key}`);
  }

  /**
   * Get the S3 bucket name
   */
  getBucket(): string {
    return this.bucket;
  }
}

// Export singleton instance
export const s3Service = new S3Service();
