import path from 'path';
import fs from 'fs';
import os from 'os';
import { GetObjectCommand, S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { spawn } from 'child_process';

/**
 * Transcode Processor
 * Handles the CPU-intensive video transcoding work
 */

export interface TranscodeJob {
  meetingId: string;
  userId: string;
  requestedAt: string;
}

export interface ProcessorConfig {
  awsRegion: string;
  s3Bucket: string;
  ddbTable: string;
  qutUsername: string;
  ffmpegPath: string;
}

export class TranscodeProcessor {
  private s3Client: S3Client;
  private ddbClient: DynamoDBDocumentClient;
  private config: ProcessorConfig;

  constructor(config: ProcessorConfig) {
    this.config = config;
    this.s3Client = new S3Client({ region: config.awsRegion });
    
    const ddbBaseClient = new DynamoDBClient({ region: config.awsRegion });
    this.ddbClient = DynamoDBDocumentClient.from(ddbBaseClient);
  }

  /**
   * Process a transcode job
   */
  async processJob(job: TranscodeJob): Promise<void> {
    const { meetingId } = job;
    let tempDir: string | null = null;

    try {
      console.log(`🎬 Starting transcode for meeting ${meetingId}`);

      // Get meeting from DynamoDB
      const meeting = await this.getMeeting(meetingId);
      if (!meeting) {
        throw new Error(`Meeting ${meetingId} not found`);
      }

      // Update status to processing
      await this.updateMeeting(meetingId, { status: 'processing' });

      // Create temp directory
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transcode-'));

      // Download input from S3
      const originalFilename = meeting.originalFilename || 'input.mp4';
      const inputExtension = originalFilename.split('.').pop() || 'mp4';
      const inputS3Key = `${meeting.s3Prefix}/${originalFilename}`;
      const inputTempPath = path.join(tempDir, `input.${inputExtension}`);

      console.log(`📥 Downloading from S3: ${inputS3Key}`);
      await this.downloadFromS3(inputS3Key, inputTempPath);

      // Transcode video with ffmpeg
      console.log(`🎬 Running ffmpeg transcode...`);
      const result = await this.transcodeVideo(inputTempPath, tempDir);

      // Upload renditions to S3
      console.log(`📤 Uploading renditions to S3...`);
      for (const rendition of result.renditions) {
        const filename = path.basename(rendition.path);
        const s3Key = `${meeting.s3Prefix}/${filename}`;

        await this.uploadToS3(rendition.path, s3Key, 'video/mp4');

        // Save rendition metadata to DynamoDB
        await this.createRendition({
          meetingId,
          resolution: rendition.resolution,
          key: s3Key,
          sizeBytes: rendition.size_bytes
        });
      }

      // Upload audio to S3
      const audioPath = path.join(tempDir, 'audio.mp3');
      if (fs.existsSync(audioPath)) {
        const audioKey = `${meeting.s3Prefix}/audio.mp3`;
        console.log(`📤 Uploading audio to S3: ${audioKey}`);
        await this.uploadToS3(audioPath, audioKey, 'audio/mpeg');
        console.log(`✅ Audio uploaded successfully: ${audioKey}`);
      } else {
        console.warn(`⚠️ Audio file not found at: ${audioPath}`);
      }

      // Upload thumbnails to S3
      for (const thumb of result.thumbnails) {
        const filename = path.basename(thumb);
        const s3Key = `${meeting.s3Prefix}/${filename}`;
        await this.uploadToS3(thumb, s3Key, 'image/jpeg');
      }

      // Update meeting metadata - status = done
      await this.updateMeeting(meetingId, {
        duration_s: result.duration_s,
        status: 'done'
      });

      console.log(`✅ Transcode completed for meeting ${meetingId}`);
    } catch (error) {
      console.error(`❌ Transcode failed for meeting ${meetingId}:`, error);

      // Update status to failed
      await this.updateMeeting(meetingId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    } finally {
      // Cleanup temp directory
      if (tempDir && fs.existsSync(tempDir)) {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
          console.log(`🧹 Cleaned up temp directory: ${tempDir}`);
        } catch (cleanupError) {
          console.warn(`⚠️ Failed to cleanup temp directory:`, cleanupError);
        }
      }
    }
  }

  /**
   * Download file from S3
   */
  private async downloadFromS3(key: string, localPath: string): Promise<void> {
    const command = new GetObjectCommand({
      Bucket: this.config.s3Bucket,
      Key: key
    });

    const response = await this.s3Client.send(command);
    const stream = response.Body as any;
    const writeStream = fs.createWriteStream(localPath);

    await new Promise<void>((resolve, reject) => {
      stream.pipe(writeStream);
      stream.on('error', reject);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  }

  /**
   * Upload file to S3
   */
  private async uploadToS3(localPath: string, key: string, contentType: string): Promise<void> {
    const fileBuffer = fs.readFileSync(localPath);

    const command = new PutObjectCommand({
      Bucket: this.config.s3Bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType
    });

    await this.s3Client.send(command);
  }

  /**
   * Transcode video using ffmpeg
   */
  private async transcodeVideo(inputPath: string, outputDir: string): Promise<{
    renditions: Array<{ path: string; resolution: string; size_bytes: number }>;
    thumbnails: string[];
    duration_s: number;
  }> {
    // Get video duration
    const duration_s = await this.getVideoDuration(inputPath);

    // Generate renditions (720p, 480p, 360p)
    const resolutions = [
      { name: '720p', height: 720 },
      { name: '480p', height: 480 },
      { name: '360p', height: 360 }
    ];

    const renditions = [];
    for (const res of resolutions) {
      const outputPath = path.join(outputDir, `output_${res.name}.mp4`);
      await this.runFFmpeg([
        '-i', inputPath,
        '-vf', `scale=-2:${res.height}`,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-y',
        outputPath
      ]);

      const stats = fs.statSync(outputPath);
      renditions.push({
        path: outputPath,
        resolution: res.name,
        size_bytes: stats.size
      });
    }

    // Extract audio
    const audioPath = path.join(outputDir, 'audio.mp3');
    await this.runFFmpeg([
      '-i', inputPath,
      '-vn',
      '-acodec', 'libmp3lame',
      '-b:a', '128k',
      '-y',
      audioPath
    ]);

    // Generate thumbnails
    const thumbnails = [];
    for (let i = 0; i < 3; i++) {
      const timestamp = Math.floor((duration_s / 4) * (i + 1));
      const thumbPath = path.join(outputDir, `thumb_${i}.jpg`);
      await this.runFFmpeg([
        '-ss', timestamp.toString(),
        '-i', inputPath,
        '-vframes', '1',
        '-q:v', '2',
        '-y',
        thumbPath
      ]);
      thumbnails.push(thumbPath);
    }

    return { renditions, thumbnails, duration_s };
  }

  /**
   * Get video duration using ffprobe
   */
  private async getVideoDuration(videoPath: string): Promise<number> {
    const ffprobePath = this.config.ffmpegPath.replace(/ffmpeg\.exe$/, 'ffprobe.exe');

    return new Promise((resolve, reject) => {
      const args = [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        videoPath
      ];

      const proc = spawn(ffprobePath, args);
      let output = '';

      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`ffprobe exited with code ${code}`));
        } else {
          const duration = parseFloat(output.trim());
          if (isNaN(duration)) {
            reject(new Error('Could not parse video duration'));
          } else {
            resolve(Math.floor(duration));
          }
        }
      });

      proc.on('error', reject);
    });
  }

  /**
   * Run ffmpeg command
   */
  private async runFFmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.config.ffmpegPath, args);

      proc.stderr.on('data', (data) => {
        // ffmpeg outputs to stderr, log for debugging
        // console.log(data.toString());
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`ffmpeg exited with code ${code}`));
        } else {
          resolve();
        }
      });

      proc.on('error', reject);
    });
  }

  /**
   * Get meeting from DynamoDB
   */
  private async getMeeting(meetingId: string): Promise<any | null> {
    const command = new GetCommand({
      TableName: this.config.ddbTable,
      Key: {
        'qut-username': this.config.qutUsername,
        'sk': `MEETING#${meetingId}`
      }
    });

    const result = await this.ddbClient.send(command);
    return result.Item || null;
  }

  /**
   * Update meeting in DynamoDB
   */
  private async updateMeeting(meetingId: string, updates: Record<string, any>): Promise<void> {
    const updateExpression: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    // Always update lastUpdatedAt
    updates.lastUpdatedAt = new Date().toISOString();

    Object.keys(updates).forEach((key, index) => {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateExpression.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = updates[key];
    });

    const command = new UpdateCommand({
      TableName: this.config.ddbTable,
      Key: {
        'qut-username': this.config.qutUsername,
        'sk': `MEETING#${meetingId}`
      },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues
    });

    await this.ddbClient.send(command);
  }

  /**
   * Create rendition in DynamoDB
   */
  private async createRendition(rendition: {
    meetingId: string;
    resolution: string;
    key: string;
    sizeBytes: number;
  }): Promise<void> {
    const command = new PutCommand({
      TableName: this.config.ddbTable,
      Item: {
        'qut-username': this.config.qutUsername,
        'sk': `REND#${rendition.meetingId}#${rendition.resolution}`,
        ...rendition
      }
    });

    await this.ddbClient.send(command);
  }
}

