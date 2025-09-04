CREATE TABLE IF NOT EXISTS users(
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
  pw_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meetings(
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  orig_filename TEXT,
  duration_s REAL,
  status TEXT DEFAULT 'uploaded',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS renditions(
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  path TEXT NOT NULL,
  resolution TEXT,
  size_bytes INTEGER
);

CREATE TABLE IF NOT EXISTS captions(
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  srt_path TEXT,
  vtt_path TEXT,
  segments_json TEXT
);

CREATE TABLE IF NOT EXISTS actions(
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  owner_raw TEXT,
  owner_resolved TEXT,
  due_date TEXT,
  priority TEXT,
  start_s REAL,
  end_s REAL,
  source TEXT
);

-- Optional table for Trello integration (not required to run core MVP)
CREATE TABLE IF NOT EXISTS trello_links(
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  board_id TEXT,
  list_id TEXT,
  card_ids_json TEXT
); 