CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  school_email  TEXT UNIQUE NOT NULL,
  student_id    TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'student'
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
