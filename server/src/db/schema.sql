CREATE TABLE IF NOT EXISTS users (
  id           SERIAL PRIMARY KEY,
  school_email TEXT UNIQUE NOT NULL,
  role         TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'security'))
);

CREATE TABLE IF NOT EXISTS items (
  id                  SERIAL PRIMARY KEY,
  finder_id           INTEGER NOT NULL REFERENCES users(id),
  title               TEXT NOT NULL,            -- public general description
  category            TEXT,
  location            TEXT,
  is_sensitive        BOOLEAN NOT NULL DEFAULT FALSE,  -- ID/card/phone -> security only
  status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claim pending', 'handed off')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()  -- when it was posted
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
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'))
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

-- Indexes on the columns rows are looked up by. Postgres doesn't create them
-- for foreign keys, and deleting an item has to find its questions, photos and claims.
CREATE INDEX IF NOT EXISTS items_finder_idx ON items (finder_id);
CREATE INDEX IF NOT EXISTS item_questions_item_idx ON item_questions (item_id);
CREATE INDEX IF NOT EXISTS item_images_item_idx ON item_images (item_id);
CREATE INDEX IF NOT EXISTS claims_item_idx ON claims (item_id);
CREATE INDEX IF NOT EXISTS claims_claimant_idx ON claims (claimant_id);
CREATE INDEX IF NOT EXISTS claim_answers_claim_idx ON claim_answers (claim_id);
CREATE INDEX IF NOT EXISTS claim_answers_question_idx ON claim_answers (question_id);
CREATE INDEX IF NOT EXISTS handoffs_claim_idx ON handoffs (claim_id);
CREATE INDEX IF NOT EXISTS handoffs_staff_idx ON handoffs (staff_id);
