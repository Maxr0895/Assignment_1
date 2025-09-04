import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface TranscodeResult {
  renditions: Array<{
    id: string;
    path: string;
    resolution: string;
    size_bytes: number;
  }>;
  audioPath: string;
  thumbnails: string[];
  duration_s: number;
}

export class FFmpegService {
  private ffmpegBin: string;

  constructor() {
    this.ffmpegBin = process.env.FFMPEG_PATH || 'ffmpeg';
  }

  private async runFFmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.ffmpegBin, args, { stdio: 'pipe', shell: process.platform === 'win32' });
      
      let stderr = '';
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
        }
      });
      
      child.on('error', (error) => {
        reject(new Error(`FFmpeg spawn error: ${error.message}`));
      });
    });
  }

  private async getVideoDuration(inputPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.ffmpegBin, ['-i', inputPath, '-f', 'null', '-'], { stdio: 'pipe', shell: process.platform === 'win32' });
      
      let stderr = '';
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', () => {
        const durationMatch = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
        if (durationMatch) {
          const hours = parseInt(durationMatch[1]);
          const minutes = parseInt(durationMatch[2]);
          const seconds = parseInt(durationMatch[3]);
          const centiseconds = parseInt(durationMatch[4]);
          
          const totalSeconds = hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
          resolve(totalSeconds);
        } else {
          reject(new Error('Could not parse video duration'));
        }
      });

      child.on('error', (error) => {
        reject(new Error(`FFmpeg spawn error: ${error.message}`));
      });
    });
  }

  async transcodeVideo(inputPath: string, outputDir: string): Promise<TranscodeResult> {
    // Ensure output directory exists
    fs.mkdirSync(outputDir, { recursive: true });
    
    const outputPaths = {
      '1080p': path.join(outputDir, 'out_1080p.mp4'),
      '720p': path.join(outputDir, 'out_720p.mp4'),
      audio: path.join(outputDir, 'audio.mp3')
    };
    
    // Get video duration first
    const duration = await this.getVideoDuration(inputPath);
    
    // Transcode to 1080p
    await this.runFFmpeg([
      '-y', '-i', inputPath,
      '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '22',
      '-vf', 'scale=-2:1080',
      outputPaths['1080p']
    ]);
    
    // Transcode to 720p
    await this.runFFmpeg([
      '-y', '-i', inputPath,
      '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '24',
      '-vf', 'scale=-2:720',
      outputPaths['720p']
    ]);
    
    // Extract compressed audio (mono 16kHz, 32kbps MP3)
    await this.runFFmpeg([
      '-y', '-i', inputPath,
      '-vn', '-ac', '1', '-ar', '16000', '-b:a', '32k',
      outputPaths.audio
    ]);
    
    // Generate thumbnails every 2 seconds
    const thumbsPattern = path.join(outputDir, 'thumbs_%03d.jpg');
    await this.runFFmpeg([
      '-y', '-i', inputPath,
      '-vf', 'fps=1/2',
      thumbsPattern
    ]);
    
    // Get file sizes and collect thumbnail paths
    const renditions = [
      {
        id: uuidv4(),
        path: outputPaths['1080p'],
        resolution: '1080p',
        size_bytes: fs.statSync(outputPaths['1080p']).size
      },
      {
        id: uuidv4(),
        path: outputPaths['720p'],
        resolution: '720p',
        size_bytes: fs.statSync(outputPaths['720p']).size
      }
    ];
    
    // Find all generated thumbnails
    const thumbnails = fs.readdirSync(outputDir)
      .filter(file => file.startsWith('thumbs_') && file.endsWith('.jpg'))
      .map(file => path.join(outputDir, file))
      .sort();
    
    return {
      renditions,
      audioPath: outputPaths.audio,
      thumbnails,
      duration_s: duration
    };
  }
}