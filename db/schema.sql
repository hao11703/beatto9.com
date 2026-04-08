CREATE TABLE IF NOT EXISTS game_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_name TEXT NOT NULL,
  game_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  anonymous_user_id TEXT NOT NULL,
  level_number INTEGER,
  metadata_json TEXT,
  queued_at INTEGER,
  received_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_game_events_game_id ON game_events(game_id);
CREATE INDEX IF NOT EXISTS idx_game_events_session_id ON game_events(session_id);
CREATE INDEX IF NOT EXISTS idx_game_events_received_at ON game_events(received_at);

CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL,
  anonymous_user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  best_level INTEGER NOT NULL,
  best_time_ms INTEGER,
  total_attempts INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(game_id, anonymous_user_id)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_game_id ON leaderboard_entries(game_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_rank ON leaderboard_entries(game_id, best_level DESC, best_time_ms ASC, updated_at ASC);
