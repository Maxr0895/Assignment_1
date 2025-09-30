import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand
} from '@aws-sdk/lib-dynamodb';
import { config } from '../config';

// Initialize DynamoDB client
const ddbClient = new DynamoDBClient({
  region: config.awsRegion
});

const docClient = DynamoDBDocumentClient.from(ddbClient);

const TABLE_NAME = config.ddbTable;
const PARTITION_KEY = config.qutUsername;

/**
 * DynamoDB Service for single-table design
 * 
 * Table schema:
 * - Partition key: qut-username (string) - always set to config.qutUsername
 * - Sort key: sk (string) - format depends on entity type:
 *   - Meeting: "MEETING#<uuid>"
 *   - Rendition: "REND#<meetingId>#<resolution>"
 *   - Captions: "CAPTIONS#<meetingId>"
 *   - Action: "ACTION#<meetingId>#<actionId>"
 *   - Idempotency: "IDEMP#<key>"
 * 
 * Meeting status values: "uploaded" | "processing" | "done" | "failed"
 */
export class DDBService {
  private tableName: string;
  private partitionKey: string;

  constructor() {
    this.tableName = TABLE_NAME;
    this.partitionKey = PARTITION_KEY;
  }

  /**
   * Put an item into DynamoDB
   */
  async putItem(item: any): Promise<void> {
    // Ensure partition key is always set
    const fullItem = {
      'qut-username': this.partitionKey,
      ...item
    };

    const command = new PutCommand({
      TableName: this.tableName,
      Item: fullItem
    });

    await docClient.send(command);
  }

  /**
   * Get an item by sort key
   * @param sk - Sort key value
   */
  async getItem(sk: string): Promise<any | null> {
    const command = new GetCommand({
      TableName: this.tableName,
      Key: {
        'qut-username': this.partitionKey,
        'sk': sk
      }
    });

    const result = await docClient.send(command);
    return result.Item || null;
  }

  /**
   * Query items by sort key prefix
   * @param prefix - Sort key prefix (e.g., "MEETING#", "ACTION#uuid#")
   * @param limit - Maximum number of items to return
   */
  async queryByPrefix(prefix: string, limit?: number): Promise<any[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :prefix)',
      ExpressionAttributeNames: {
        '#pk': 'qut-username',
        '#sk': 'sk'
      },
      ExpressionAttributeValues: {
        ':pk': this.partitionKey,
        ':prefix': prefix
      },
      Limit: limit
    });

    const result = await docClient.send(command);
    return result.Items || [];
  }

  /**
   * Update an item
   * @param sk - Sort key
   * @param updates - Object with fields to update
   */
  async updateItem(sk: string, updates: Record<string, any>): Promise<void> {
    const updateExpression: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    Object.keys(updates).forEach((key, index) => {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateExpression.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = updates[key];
    });

    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: {
        'qut-username': this.partitionKey,
        'sk': sk
      },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues
    });

    await docClient.send(command);
  }

  /**
   * Delete an item
   * @param sk - Sort key
   */
  async deleteItem(sk: string): Promise<void> {
    const command = new DeleteCommand({
      TableName: this.tableName,
      Key: {
        'qut-username': this.partitionKey,
        'sk': sk
      }
    });

    await docClient.send(command);
  }

  // ===== Meeting-specific helpers =====

  /**
   * Create a new meeting
   */
  async createMeeting(meeting: {
    id: string;
    title: string;
    status: string;
    s3Prefix: string;
    created_at: string;
    duration_s?: number;
    originalFilename?: string;
  }): Promise<void> {
    await this.putItem({
      sk: `MEETING#${meeting.id}`,
      lastUpdatedAt: new Date().toISOString(),
      ...meeting
    });
  }

  /**
   * Get a meeting by ID
   */
  async getMeeting(meetingId: string): Promise<any | null> {
    return await this.getItem(`MEETING#${meetingId}`);
  }

  /**
   * List all meetings
   */
  async listMeetings(limit?: number): Promise<any[]> {
    return await this.queryByPrefix('MEETING#', limit);
  }

  /**
   * Update meeting fields (always sets lastUpdatedAt)
   */
  async updateMeeting(meetingId: string, updates: Record<string, any>): Promise<void> {
    const updatesWithTimestamp = {
      ...updates,
      lastUpdatedAt: new Date().toISOString()
    };
    await this.updateItem(`MEETING#${meetingId}`, updatesWithTimestamp);
  }

  // ===== Rendition helpers =====

  /**
   * Create a rendition
   */
  async createRendition(rendition: {
    meetingId: string;
    resolution: string;
    key: string;
    sizeBytes?: number;
  }): Promise<void> {
    await this.putItem({
      sk: `REND#${rendition.meetingId}#${rendition.resolution}`,
      ...rendition
    });
  }

  /**
   * Get renditions for a meeting
   */
  async getRenditions(meetingId: string): Promise<any[]> {
    return await this.queryByPrefix(`REND#${meetingId}#`);
  }

  // ===== Captions helpers =====

  /**
   * Create/update captions
   */
  async createCaptions(captions: {
    meetingId: string;
    srtKey?: string;
    vttKey?: string;
    segments: any[];
  }): Promise<void> {
    await this.putItem({
      sk: `CAPTIONS#${captions.meetingId}`,
      ...captions
    });
  }

  /**
   * Get captions for a meeting
   */
  async getCaptions(meetingId: string): Promise<any | null> {
    return await this.getItem(`CAPTIONS#${meetingId}`);
  }

  // ===== Action helpers =====

  /**
   * Create an action item
   */
  async createAction(action: {
    meetingId: string;
    actionId: string;
    summary: string;
    owner?: string;
    due_date?: string;
    priority?: string;
    start: number;
    end: number;
    tags?: string[];
  }): Promise<void> {
    await this.putItem({
      sk: `ACTION#${action.meetingId}#${action.actionId}`,
      ...action
    });
  }

  /**
   * Get all actions for a meeting
   */
  async getActions(meetingId: string): Promise<any[]> {
    return await this.queryByPrefix(`ACTION#${meetingId}#`);
  }

  /**
   * Get all actions (for reports)
   */
  async getAllActions(limit?: number): Promise<any[]> {
    return await this.queryByPrefix('ACTION#', limit);
  }

  // ===== Idempotency helpers =====

  /**
   * Check if an idempotency key has been used
   * @param key - Idempotency key
   * @returns The existing operation result if key was used, null otherwise
   */
  async checkIdempotencyKey(key: string): Promise<any | null> {
    return await this.getItem(`IDEMP#${key}`);
  }

  /**
   * Store an idempotency key with operation result
   * @param key - Idempotency key
   * @param meetingId - Meeting ID
   * @param operation - Operation type (e.g., "transcode", "transcribe", "actions")
   * @param result - Operation result to store
   */
  async storeIdempotencyKey(
    key: string,
    meetingId: string,
    operation: string,
    result: any
  ): Promise<void> {
    await this.putItem({
      sk: `IDEMP#${key}`,
      meetingId,
      operation,
      result,
      timestamp: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + 86400 // 24 hour TTL
    });
  }
}

// Export singleton instance
export const ddbService = new DDBService();
