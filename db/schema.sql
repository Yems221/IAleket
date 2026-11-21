-- HomeBoard Schema
-- D1 (SQLite) — deux utilisateurs, droits égaux, moodboard collaboratif

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('link', 'photo')),
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  price TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'moodboard'
    CHECK (status IN ('moodboard', 'proposition', 'achete')),
  purchased_by TEXT REFERENCES users(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  deleted_at TEXT,            -- corbeille : NULL = actif, sinon date de mise à la corbeille
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Catégories non exclusives : un item peut appartenir à plusieurs espaces
CREATE TABLE IF NOT EXISTS item_spaces (
  item_id  TEXT NOT NULL REFERENCES items(id)  ON DELETE CASCADE,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, space_id)
);

CREATE INDEX IF NOT EXISTS idx_items_space_id ON items(space_id);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_deleted_at ON items(deleted_at);
CREATE INDEX IF NOT EXISTS idx_item_spaces_space ON item_spaces(space_id);
CREATE INDEX IF NOT EXISTS idx_item_spaces_item ON item_spaces(item_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
