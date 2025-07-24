// SQLite schema definitions for caching

export const CREATE_CHANGES_TABLE = `
  CREATE TABLE IF NOT EXISTS changes (
    id TEXT PRIMARY KEY,
    project TEXT NOT NULL,
    branch TEXT NOT NULL,
    change_id TEXT NOT NULL UNIQUE,
    subject TEXT NOT NULL,
    status TEXT NOT NULL,
    created TEXT NOT NULL,
    updated TEXT NOT NULL,
    insertions INTEGER NOT NULL,
    deletions INTEGER NOT NULL,
    number INTEGER NOT NULL,
    owner_account_id INTEGER NOT NULL,
    owner_name TEXT,
    owner_email TEXT,
    owner_username TEXT,
    cached_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    expires_at INTEGER,
    etag TEXT,
    UNIQUE(change_id)
  )
`

export const CREATE_COMMENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    change_id TEXT NOT NULL,
    revision_id TEXT NOT NULL,
    file_path TEXT,
    line_number INTEGER,
    message TEXT NOT NULL,
    author_account_id INTEGER NOT NULL,
    author_name TEXT,
    author_email TEXT,
    created TEXT NOT NULL,
    updated TEXT NOT NULL,
    unresolved BOOLEAN DEFAULT FALSE,
    cached_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (change_id) REFERENCES changes(change_id)
  )
`

export const CREATE_CACHE_METADATA_TABLE = `
  CREATE TABLE IF NOT EXISTS cache_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  )
`

export const CREATE_INDEXES: readonly string[] = [
  'CREATE INDEX IF NOT EXISTS idx_changes_status ON changes(status)',
  'CREATE INDEX IF NOT EXISTS idx_changes_project ON changes(project)',
  'CREATE INDEX IF NOT EXISTS idx_changes_updated ON changes(updated)',
  'CREATE INDEX IF NOT EXISTS idx_changes_expires_at ON changes(expires_at)',
  'CREATE INDEX IF NOT EXISTS idx_comments_change_id ON comments(change_id)',
  'CREATE INDEX IF NOT EXISTS idx_comments_file_path ON comments(file_path)',
  'CREATE INDEX IF NOT EXISTS idx_cache_metadata_expires ON cache_metadata(expires_at)',
]
