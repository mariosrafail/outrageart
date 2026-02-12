CREATE TABLE IF NOT EXISTS media_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  art_base_url TEXT NOT NULL,
  thumb_base_url TEXT NOT NULL,
  art_default_file TEXT NOT NULL DEFAULT '1.png',
  thumb_file_pattern TEXT NOT NULL DEFAULT '{slug}.png',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  theme TEXT NOT NULL,
  gender TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  url_override TEXT,
  thumb_override TEXT,
  shop TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS items_theme_idx ON items(theme);
CREATE INDEX IF NOT EXISTS items_gender_idx ON items(gender);
CREATE INDEX IF NOT EXISTS items_difficulty_idx ON items(difficulty);

CREATE TABLE IF NOT EXISTS item_tags (
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (item_id, tag)
);

