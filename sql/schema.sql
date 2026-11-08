-- Run once in Neon SQL Editor before deploying.
CREATE TABLE IF NOT EXISTS catalog (
  kind text NOT NULL CHECK (kind IN ('group', 'teacher', 'room')),
  id text NOT NULL,
  label text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, id)
);
CREATE INDEX IF NOT EXISTS catalog_kind_label_idx ON catalog (kind, label);

CREATE TABLE IF NOT EXISTS schedules (
  kind text NOT NULL CHECK (kind IN ('group', 'teacher')),
  id text NOT NULL,
  exam boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL,
  content_hash text NOT NULL,
  source_updated text,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, id, exam)
);

CREATE TABLE IF NOT EXISTS interests (
  kind text NOT NULL CHECK (kind IN ('group', 'teacher')),
  id text NOT NULL,
  exam boolean NOT NULL DEFAULT false,
  requested_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  PRIMARY KEY (kind, id, exam)
);
CREATE INDEX IF NOT EXISTS interests_due_idx ON interests (requested_at DESC, last_synced_at ASC);

CREATE TABLE IF NOT EXISTS schedule_changes (
  change_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL,
  id text NOT NULL,
  exam boolean NOT NULL DEFAULT false,
  old_hash text NOT NULL,
  new_hash text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- Low-cost anonymous API write throttling (no raw visitor IP stored).
CREATE TABLE IF NOT EXISTS request_rate_limits (
  client_hash text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  counter integer NOT NULL DEFAULT 1
);
