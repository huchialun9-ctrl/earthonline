-- D1 Schema: Earth Online accounts only
-- Game data lives in DO Storage SQLite

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  discord_id TEXT,
  discord_username TEXT,
  discord_avatar TEXT,
  role TEXT DEFAULT 'user',
  country TEXT DEFAULT 'TW',
  home_region TEXT DEFAULT 'asia',
  recovery_key TEXT,
  email TEXT,
  is_email_verified INTEGER DEFAULT 0,
  email_verification_token TEXT,
  email_verification_expires INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_accounts_discord ON accounts(discord_id);
CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);
