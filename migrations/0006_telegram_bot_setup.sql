CREATE TABLE telegram_bot_setup (
  id INTEGER PRIMARY KEY CHECK(id=1),
  username TEXT NOT NULL,
  configured_at INTEGER NOT NULL DEFAULT(unixepoch())
);
