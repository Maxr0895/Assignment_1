import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

let db: Database.Database;

export function initializeDatabase() {
  // Ensure data directory exists
  if (!fs.existsSync(config.dataDir)) {
    fs.mkdirSync(config.dataDir, { recursive: true });
  }

  const dbPath = path.join(config.dataDir, 'app.db');
  db = new Database(dbPath);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Read and execute schema
  const schemaPath = path.join(__dirname, '../models/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);
  
  console.log('Database initialized at:', dbPath);
  return db;
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export function closeDatabase() {
  if (db) {
    db.close();
  }
}

// Helper functions for common queries
export const dbHelpers = {
  getUserByUsername: (username: string) => {
    return getDatabase().prepare('SELECT * FROM users WHERE username = ?').get(username);
  },
  
  createMeeting: (id: string, userId: string, title: string, origFilename: string) => {
    return getDatabase().prepare(`
      INSERT INTO meetings (id, user_id, title, orig_filename, created_at) 
      VALUES (?, ?, ?, ?, ?)
    `).run(id, userId, title, origFilename, new Date().toISOString());
  },
  
  getMeetingById: (id: string) => {
    return getDatabase().prepare('SELECT * FROM meetings WHERE id = ?').get(id);
  },
  
  getMeetings: (limit: number, offset: number, sortBy: string, order: string) => {
    const allowedSort = new Set(['created_at', 'title', 'status', 'duration_s']);
    const allowedOrder = new Set(['ASC', 'DESC']);

    const sortColumn = allowedSort.has(sortBy) ? sortBy : 'created_at';
    const sortOrder = allowedOrder.has(order.toUpperCase()) ? order.toUpperCase() : 'DESC';

    const query = `SELECT * FROM meetings ORDER BY ${sortColumn} ${sortOrder} LIMIT ? OFFSET ?`;
    return getDatabase().prepare(query).all(limit, offset);
  },
  
  updateMeetingStatus: (id: string, status: string) => {
    return getDatabase().prepare('UPDATE meetings SET status = ? WHERE id = ?').run(status, id);
  },
  
  updateMeetingDuration: (id: string, duration: number) => {
    return getDatabase().prepare('UPDATE meetings SET duration_s = ? WHERE id = ?').run(duration, id);
  },
  
  insertRendition: (id: string, meetingId: string, path: string, resolution: string, sizeBytes: number) => {
    return getDatabase().prepare(`
      INSERT INTO renditions (id, meeting_id, path, resolution, size_bytes) 
      VALUES (?, ?, ?, ?, ?)
    `).run(id, meetingId, path, resolution, sizeBytes);
  },
  
  insertCaptions: (id: string, meetingId: string, srtPath: string, vttPath: string, segmentsJson: string) => {
    return getDatabase().prepare(`
      INSERT INTO captions (id, meeting_id, srt_path, vtt_path, segments_json) 
      VALUES (?, ?, ?, ?, ?)
    `).run(id, meetingId, srtPath, vttPath, segmentsJson);
  },
  
  insertAction: (id: string, meetingId: string, summary: string, ownerRaw: string, ownerResolved: string, 
                 dueDate: string, priority: string, startS: number, endS: number, source: string) => {
    return getDatabase().prepare(`
      INSERT INTO actions (id, meeting_id, summary, owner_raw, owner_resolved, due_date, priority, start_s, end_s, source) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, meetingId, summary, ownerRaw, ownerResolved, dueDate, priority, startS, endS, source);
  },
  
  getActionsByMeeting: (meetingId: string) => {
    return getDatabase().prepare('SELECT * FROM actions WHERE meeting_id = ?').all(meetingId);
  },
  
  getRenditionsByMeeting: (meetingId: string) => {
    return getDatabase().prepare('SELECT * FROM renditions WHERE meeting_id = ?').all(meetingId);
  },
  
  getCaptionsByMeeting: (meetingId: string) => {
    return getDatabase().prepare('SELECT * FROM captions WHERE meeting_id = ?').get(meetingId);
  }
};