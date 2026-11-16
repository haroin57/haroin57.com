-- Apply only to Habit. Existing habit_logs / daily_todos remain unchanged.
CREATE TABLE IF NOT EXISTS becs_snapshots (
  sequence INTEGER PRIMARY KEY,
  revision INTEGER NOT NULL,
  document_json TEXT NOT NULL,
  derived_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS nfc_scan_attempts (
  scan_id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  tag_id TEXT,
  device_id TEXT,
  source TEXT NOT NULL,
  occurred_at TEXT,
  received_at TEXT NOT NULL,
  outcome TEXT NOT NULL,
  response_json TEXT NOT NULL,
  http_status INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS becs_scan_received ON nfc_scan_attempts(received_at);
CREATE TABLE IF NOT EXISTS behavior_events (
  event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  scan_id TEXT,
  occurred_at TEXT,
  received_at TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS becs_event_received ON behavior_events(received_at);
CREATE TABLE IF NOT EXISTS becs_web_sessions (
  token_hash TEXT PRIMARY KEY,
  csrf_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS becs_login_limits (
  bucket TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires_at TEXT NOT NULL
);
-- Queryable projections are updated in the same batch as each snapshot.
CREATE TABLE IF NOT EXISTS nfc_tags (tag_id TEXT PRIMARY KEY, purpose TEXT NOT NULL, status TEXT NOT NULL, version INTEGER NOT NULL, record_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS nfc_bindings (binding_id TEXT PRIMARY KEY, tag_id TEXT NOT NULL, device_id TEXT NOT NULL, disabled_at TEXT, record_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS device_nodes (device_id TEXT PRIMARY KEY, device_type TEXT NOT NULL, status TEXT NOT NULL, record_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS routine_sessions (id TEXT PRIMARY KEY, plan_date TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL, record_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS daily_plans (local_date TEXT PRIMARY KEY, timezone TEXT NOT NULL DEFAULT 'Asia/Tokyo', record_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS device_commands (command_id TEXT PRIMARY KEY, device_id TEXT NOT NULL, policy_revision INTEGER NOT NULL, status TEXT NOT NULL, record_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS override_sessions (id TEXT PRIMARY KEY, expires_at TEXT NOT NULL, record_json TEXT NOT NULL);
-- Reject stale writers even after old snapshots have been compacted.
CREATE TRIGGER IF NOT EXISTS becs_sequence_guard
BEFORE INSERT ON becs_snapshots
WHEN NEW.sequence <> COALESCE((SELECT MAX(sequence) FROM becs_snapshots), 0) + 1
BEGIN
  SELECT RAISE(ABORT, 'BECS_SEQUENCE_CONSTRAINT');
END;
