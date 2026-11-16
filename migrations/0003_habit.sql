CREATE TABLE IF NOT EXISTS habit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_date DATE NOT NULL UNIQUE,
  squat_count INTEGER NOT NULL DEFAULT 0 CHECK(squat_count >= 0),
  pushup_sets INTEGER NOT NULL DEFAULT 0 CHECK(pushup_sets >= 0),
  abs_sets INTEGER NOT NULL DEFAULT 0 CHECK(abs_sets >= 0),
  bike_minutes INTEGER NOT NULL DEFAULT 0 CHECK(bike_minutes >= 0),
  english_count INTEGER NOT NULL DEFAULT 0 CHECK(english_count >= 0),
  drawing_done INTEGER NOT NULL DEFAULT 0 CHECK(drawing_done IN (0,1)),
  screenshot_count INTEGER NOT NULL DEFAULT 0 CHECK(screenshot_count >= 0),
  work_focus_done INTEGER NOT NULL DEFAULT 0 CHECK(work_focus_done IN (0,1)),
  circuit_done INTEGER NOT NULL DEFAULT 0 CHECK(circuit_done IN (0,1)),
  shadowing_done INTEGER NOT NULL DEFAULT 0 CHECK(shadowing_done IN (0,1)),
  memo TEXT NOT NULL DEFAULT '',
  drawing_image_url TEXT,
  tweeted INTEGER NOT NULL DEFAULT 0 CHECK(tweeted IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS daily_todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_date DATE NOT NULL,
  priority INTEGER NOT NULL CHECK(priority BETWEEN 1 AND 3),
  title TEXT NOT NULL,
  is_completed INTEGER NOT NULL DEFAULT 0 CHECK(is_completed IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(target_date, priority)
);
