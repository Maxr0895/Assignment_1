import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { config } from '../config';
import { getOpenAIKey } from './secrets';

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

interface ActionItem {
  summary: string;
  owner: string | null;
  due_date: string | null;
  priority: string | null;
  start: number;
  end: number;
  tags: string[];
}

export class OpenAIService {
  private client?: OpenAI;
  private initPromise?: Promise<void>;
  private initialized = false;
  
  constructor() {
    // Lazy initialization - client will be created on first use
  }
  
  /**
   * Initialize the OpenAI client with API key from Secrets Manager or environment
   */
  private async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = (async () => {
      try {
        const apiKey = await getOpenAIKey();
        
        if (apiKey) {
          // Create a custom HTTPS agent with keepAlive to prevent ECONNRESET
          const httpsAgent = new https.Agent({
            keepAlive: true,
            keepAliveMsecs: 30000,
            maxSockets: 50,
            timeout: 300000
          });

          this.client = new OpenAI({
            apiKey,
            maxRetries: 3,
            timeout: 300000, // 5 minutes
            httpAgent: httpsAgent
          });

          console.log('✅ OpenAI client initialized');
        } else {
          console.log('⚠️  OpenAI API key not available');
        }

        this.initialized = true;
      } catch (error) {
        console.error('❌ Failed to initialize OpenAI client:', error);
        this.initialized = true; // Mark as initialized to prevent infinite retries
      }
    })();

    await this.initPromise;
  }
  
  async isAvailable(): Promise<boolean> {
    await this.initialize();
    return !!this.client;
  }
  
  async transcribeAudio(audioPath: string): Promise<TranscriptSegment[]> {
    await this.initialize();
    
    if (!this.client) {
      throw new Error('OpenAI client not available');
    }

    console.log(`Attempting transcription of: ${audioPath}`);
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    const stats = fs.statSync(audioPath);
    console.log(`Audio file size: ${stats.size} bytes (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);

    if (stats.size > 25 * 1024 * 1024) {
      throw new Error(`Audio file too large: ${(stats.size / 1024 / 1024).toFixed(1)}MB (max 25MB)`);
    }
    
    // Aggressive retry wrapper
    const retryWithBackoff = async (fn: () => Promise<any>, maxAttempts: number = 3): Promise<any> => {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          console.log(`Attempt ${attempt}/${maxAttempts}`);
          return await fn();
        } catch (error: any) {
          if (attempt === maxAttempts) throw error;
          
          // Wait longer between retries for connection issues
          const waitTime = Math.min(1000 * Math.pow(2, attempt), 10000);
          console.log(`Attempt ${attempt} failed, waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    };
    
    const tryModel = async (model: string, response_format?: 'json' | 'text') => {
      console.log(`Trying OpenAI model: ${model} with format: ${response_format || 'default'}`);
      
      return retryWithBackoff(async () => {
        // Read file into buffer to avoid stream issues on Windows
        const fileBuffer = fs.readFileSync(audioPath);
        const file = new File([fileBuffer], path.basename(audioPath), { type: 'audio/mpeg' });
        
        const resp: any = await this.client!.audio.transcriptions.create({
          file: file,
          model,
          ...(response_format ? { response_format } : {})
        });
        
        const text: string = resp.text || '';
        if (text && text.trim().length > 0) {
          console.log(`Success with ${model}: got ${text.length} chars`);
          return [{ start: 0, end: 0, text: text.trim() }];
        }
        if (resp.segments && Array.isArray(resp.segments)) {
          console.log(`Success with ${model}: got ${resp.segments.length} segments`);
          return resp.segments.map((s: any) => ({ start: s.start || 0, end: s.end || 0, text: (s.text || '').trim() }));
        }
        return [{ start: 0, end: 0, text: text.trim() }];
      }, 3);
    };
    
    // Try models in order with aggressive retries
    const models = [
      { name: 'whisper-1', format: undefined as 'json' | 'text' | undefined }, // Most reliable
      { name: 'gpt-4o-mini-transcribe', format: 'text' as const },
      { name: 'gpt-4o-transcribe', format: 'text' as const }
    ];
    
    for (const model of models) {
      try {
        console.log(`\n=== Trying ${model.name} ===`);
        return await tryModel(model.name, model.format);
      } catch (error) {
        console.log(`${model.name} failed completely:`, error);
        continue;
      }
    }
    
    throw new Error('All OpenAI transcription models failed after retries');
  }
  
  async extractActions(segments: TranscriptSegment[]): Promise<ActionItem[]> {
    await this.initialize();
    
    if (!this.client) {
      throw new Error('OpenAI client not available');
    }
    
    const transcript = segments.map(s => `[${s.start}s-${s.end}s] ${s.text}`).join('\n');
    
    const systemPrompt = `Extract Amazon-style Weekly Business Review action items from timestamped transcript segments. \nOutput only valid JSON matching the schema; use ISO dates; infer timestamps from nearby segments.`;
    
    const schema = {
      type: "object",
      properties: {
        actions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              summary: { type: "string" },
              owner: { type: ["string", "null"] },
              due_date: { type: ["string", "null"] },
              priority: { type: ["string", "null"], enum: ["P0", "P1", "P2", null] },
              start: { type: "number" },
              end: { type: "number" },
              tags: { type: "array", items: { type: "string" } }
            },
            required: ["summary", "start", "end", "tags"],
            additionalProperties: false
          }
        }
      },
      required: ["actions"],
      additionalProperties: false
    };
    
    try {
      const completion = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: transcript }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "action_items",
            schema: schema
          }
        }
      });
      
      const content = completion.choices[0]?.message?.content;
      if (!content) {
        return [];
      }
      
      const parsed = JSON.parse(content);
      return parsed.actions || [];
    } catch (error) {
      throw new Error(`OpenAI action extraction failed: ${error}`);
    }
  }
  
  generateCaptions(segments: TranscriptSegment[]): { srt: string; vtt: string } {
    // Generate SRT format
    let srt = '';
    segments.forEach((segment, index) => {
      const startTime = this.formatSRTTime(segment.start);
      const endTime = this.formatSRTTime(segment.end);
      
      srt += `${index + 1}\n`;
      srt += `${startTime} --> ${endTime}\n`;
      srt += `${segment.text}\n\n`;
    });
    
    // Generate VTT format
    let vtt = 'WEBVTT\n\n';
    segments.forEach((segment, index) => {
      const startTime = this.formatVTTTime(segment.start);
      const endTime = this.formatVTTTime(segment.end);
      
      vtt += `${index + 1}\n`;
      vtt += `${startTime} --> ${endTime}\n`;
      vtt += `${segment.text}\n\n`;
    });
    
    return { srt, vtt };
  }
  
  private formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }
  
  private formatVTTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }
}

// Export singleton instance
export const openaiService = new OpenAIService();