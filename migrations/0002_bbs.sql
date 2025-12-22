-- BBS Threads テーブル
CREATE TABLE IF NOT EXISTS bbs_threads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  post_count INTEGER DEFAULT 1,
  last_post_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_threads_last_post_at ON bbs_threads(last_post_at DESC);

-- BBS Posts テーブル
CREATE TABLE IF NOT EXISTS bbs_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT NOT NULL,
  post_number INTEGER NOT NULL, -- スレッド内での投稿番号
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  is_deleted INTEGER DEFAULT 0,
  FOREIGN KEY (thread_id) REFERENCES bbs_threads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bbs_posts_thread ON bbs_posts(thread_id, post_number);
