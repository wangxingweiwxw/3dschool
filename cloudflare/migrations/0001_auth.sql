CREATE TABLE IF NOT EXISTS oauth_attempts (
  state_hash TEXT PRIMARY KEY,
  browser_hash TEXT NOT NULL,
  return_to TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS oauth_attempt_expiry ON oauth_attempts(expires_at);
CREATE INDEX IF NOT EXISTS oauth_attempt_browser ON oauth_attempts(browser_hash);
CREATE TABLE IF NOT EXISTS auth_sessions (
  session_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_session_expiry ON auth_sessions(expires_at);
