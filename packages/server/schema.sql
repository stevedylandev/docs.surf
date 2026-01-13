-- Records synced from external tap instance
CREATE TABLE IF NOT EXISTS repo_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  did TEXT NOT NULL,
  rkey TEXT NOT NULL,
  collection TEXT NOT NULL,
  cid TEXT,
  synced_at TEXT DEFAULT (datetime('now')),
  UNIQUE(did, collection, rkey)
);

CREATE INDEX IF NOT EXISTS idx_repo_records_collection ON repo_records(collection);
CREATE INDEX IF NOT EXISTS idx_repo_records_did ON repo_records(did);
CREATE INDEX IF NOT EXISTS idx_repo_records_rkey ON repo_records(rkey DESC);

-- Cache for resolved PDS endpoints
CREATE TABLE IF NOT EXISTS pds_cache (
  did TEXT PRIMARY KEY,
  pds_endpoint TEXT NOT NULL,
  cached_at TEXT DEFAULT (datetime('now'))
);

-- Sync metadata to track last sync
CREATE TABLE IF NOT EXISTS sync_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Pre-resolved documents for fast feed serving
CREATE TABLE IF NOT EXISTS resolved_documents (
  uri TEXT PRIMARY KEY,
  did TEXT NOT NULL,
  rkey TEXT NOT NULL,
  title TEXT,
  path TEXT,
  site TEXT,
  content TEXT,  -- JSON blob
  text_content TEXT,
  published_at TEXT,
  view_url TEXT,
  resolved_at TEXT DEFAULT (datetime('now')),
  stale_at TEXT  -- When this record should be re-resolved
);

CREATE INDEX IF NOT EXISTS idx_resolved_documents_rkey ON resolved_documents(rkey DESC);
CREATE INDEX IF NOT EXISTS idx_resolved_documents_stale ON resolved_documents(stale_at);
