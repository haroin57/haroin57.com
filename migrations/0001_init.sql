-- Posts テーブル
CREATE TABLE IF NOT EXISTS posts (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT DEFAULT '',
  markdown TEXT NOT NULL,
  html TEXT NOT NULL,
  tags TEXT DEFAULT '[]', -- JSON array
  status TEXT DEFAULT 'published' CHECK(status IN ('draft', 'published')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);

-- Products テーブル
CREATE TABLE IF NOT EXISTS products (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  language TEXT NOT NULL,
  tags TEXT DEFAULT '[]', -- JSON array
  url TEXT NOT NULL,
  demo TEXT,
  markdown TEXT,
  html TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
