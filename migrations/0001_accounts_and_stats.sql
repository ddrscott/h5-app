-- Accounts: email sign-in with a 6-digit code or a one-click link. Only hashes are stored.
CREATE TABLE users (
  id TEXT PRIMARY KEY,               -- sha256("user:" || email), first 32 hex chars
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE login_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX sessions_expires ON sessions (expires_at);

-- Guess budgets per IP and per email, so a code can't be brute forced across resends.
CREATE TABLE login_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  guesses INTEGER NOT NULL
);

-- One row per signed-in human per finished game. game_key is "<room>:<room created at>:<game seq>",
-- so a retried write after hibernation or a replayed end of game can never count twice.
CREATE TABLE game_results (
  game_key TEXT NOT NULL,
  user_id TEXT NOT NULL,
  bucket TEXT NOT NULL CHECK (bucket IN ('pvp', 'mixed', 'computer')),
  place INTEGER NOT NULL,
  players INTEGER NOT NULL,
  win INTEGER NOT NULL,
  loss INTEGER NOT NULL,
  room_id TEXT NOT NULL,
  finished_at INTEGER NOT NULL,
  PRIMARY KEY (game_key, user_id)
);
CREATE INDEX game_results_user ON game_results (user_id, bucket);
