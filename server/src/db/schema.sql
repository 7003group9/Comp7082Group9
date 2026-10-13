CREATE TABLE IF NOT EXISTS users (
  id           SERIAL PRIMARY KEY,
  school_email TEXT UNIQUE NOT NULL,
  role         TEXT NOT NULL DEFAULT 'student'  -- student | security
);

CREATE TABLE IF NOT EXISTS items (
  id                  SERIAL PRIMARY KEY,
  finder_id           INTEGER NOT NULL REFERENCES users(id),
  title               TEXT NOT NULL,            -- public general description
  category            TEXT,
  location            TEXT,
  is_sensitive        BOOLEAN NOT NULL DEFAULT FALSE,  -- ID/card/phone -> security only
  status              TEXT NOT NULL DEFAULT 'open',    -- open | claim pending | handed off
  found_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PRIVATE: never returned by public item endpoints
CREATE TABLE IF NOT EXISTS item_questions (
  id              SERIAL PRIMARY KEY,
  item_id         INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  question        TEXT NOT NULL,
  expected_answer TEXT NOT NULL
);

-- Photos of a found item, saved with the post. (Viewing them is a later sprint.)
CREATE TABLE IF NOT EXISTS item_images (
  id        SERIAL PRIMARY KEY,
  item_id   INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  mime_type TEXT NOT NULL,
  data      BYTEA NOT NULL
);

-- PRIVATE: one unfinished post per user. Kept out of items so drafts are never public.
CREATE TABLE IF NOT EXISTS drafts (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data       JSONB NOT NULL,  -- { title, building, detail, category, questions }
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS claims (
  id           SERIAL PRIMARY KEY,
  item_id      INTEGER NOT NULL REFERENCES items(id),
  claimant_id  INTEGER NOT NULL REFERENCES users(id),
  status       TEXT NOT NULL DEFAULT 'pending'   -- pending | approved | rejected
);

CREATE TABLE IF NOT EXISTS claim_answers (
  id          SERIAL PRIMARY KEY,
  claim_id    INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES item_questions(id),
  answer      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS handoffs (
  id           SERIAL PRIMARY KEY,
  claim_id     INTEGER NOT NULL REFERENCES claims(id),
  staff_id     INTEGER NOT NULL REFERENCES users(id),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
