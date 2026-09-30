CREATE TABLE IF NOT EXISTS cloud_campuses (
  campus_key TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(owner_id, content_hash)
);
CREATE INDEX IF NOT EXISTS cloud_campus_owner ON cloud_campuses(owner_id, created_at);
CREATE TABLE IF NOT EXISTS cloud_campus_chunks (
  campus_key TEXT NOT NULL REFERENCES cloud_campuses(campus_key) ON DELETE CASCADE,
  part INTEGER NOT NULL,
  content TEXT NOT NULL,
  PRIMARY KEY(campus_key, part)
);
