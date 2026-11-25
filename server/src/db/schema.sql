CREATE TABLE IF NOT EXISTS users (
  id           SERIAL PRIMARY KEY,
  school_email TEXT UNIQUE,
  role         TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'security', 'guest'))
);

CREATE TABLE IF NOT EXISTS items (
  id                  SERIAL PRIMARY KEY,
  finder_id           INTEGER NOT NULL REFERENCES users(id),
  title               TEXT NOT NULL,            -- public general description
  category            TEXT,
  location            TEXT,                     -- finder's description of the spot
  building            TEXT,                     -- campus building, optional (BUILDINGS in itemValidation.js)
  latitude            DOUBLE PRECISION CHECK (latitude BETWEEN -90 AND 90),     -- GPS pin (new posts must have one)
  longitude           DOUBLE PRECISION CHECK (longitude BETWEEN -180 AND 180),
  is_sensitive        BOOLEAN NOT NULL DEFAULT FALSE,  -- ID/card/phone -> security only
  is_hidden           BOOLEAN NOT NULL DEFAULT FALSE,  -- removed from public feeds by moderation
  status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claim pending', 'claimed', 'dropped off', 'handed off')),  -- claimed = a claim was approved; dropped off = the finder left it at Campus Security
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),  -- when it was posted
  claimed_at          TIMESTAMPTZ                           -- when a claim was approved; the feed hides it 24h later
);

ALTER TABLE items ADD COLUMN IF NOT EXISTS building TEXT;

-- PRIVATE: expected_answer never leaves the server. Only the question text is
-- shown, to a logged-in claimant on the claim form.
CREATE TABLE IF NOT EXISTS item_questions (
  id              SERIAL PRIMARY KEY,
  item_id         INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  question        TEXT NOT NULL,
  expected_answer TEXT NOT NULL
);

-- The photo of a found item, saved with the post. The small versions are made once,
-- at upload, so viewing a photo never has to process it.
CREATE TABLE IF NOT EXISTS item_images (
  id        SERIAL PRIMARY KEY,
  item_id   INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  mime_type TEXT NOT NULL,   -- of data (thumb and blurred are always WebP)
  data      BYTEA NOT NULL,  -- the original, for the finder and Campus Security
  thumb     BYTEA NOT NULL,  -- clear and small, for their feed cards
  blurred   BYTEA NOT NULL   -- small and blurred, for everyone else
);

ALTER TABLE item_images ADD COLUMN IF NOT EXISTS thumb BYTEA;
ALTER TABLE item_images ADD COLUMN IF NOT EXISTS blurred BYTEA;

ALTER TABLE users ALTER COLUMN school_email DROP NOT NULL;
DROP TABLE IF EXISTS drafts;

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

CREATE TABLE IF NOT EXISTS post_reports (
  id           SERIAL PRIMARY KEY,
  item_id      INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  reporter_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL,
  details      TEXT,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'resolved')),
  resolution   TEXT CHECK (resolution IN ('hidden', 'dismissed')),
  resolved_by  INTEGER REFERENCES users(id),
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS post_reports_one_per_user
  ON post_reports (item_id, reporter_id);
CREATE INDEX IF NOT EXISTS post_reports_item_idx ON post_reports (item_id);
CREATE INDEX IF NOT EXISTS post_reports_status_idx ON post_reports (status);

-- Indexes on the columns rows are looked up by. Postgres doesn't create them
-- for foreign keys, and deleting an item has to find its questions, photos and claims.
CREATE INDEX IF NOT EXISTS items_finder_idx ON items (finder_id);
CREATE INDEX IF NOT EXISTS item_questions_item_idx ON item_questions (item_id);
CREATE INDEX IF NOT EXISTS item_images_item_idx ON item_images (item_id);
CREATE INDEX IF NOT EXISTS claims_item_idx ON claims (item_id);
CREATE INDEX IF NOT EXISTS claims_claimant_idx ON claims (claimant_id);
-- One try per item: a person can only ever claim the same item once, even if rejected.
CREATE UNIQUE INDEX IF NOT EXISTS claims_one_per_user ON claims (item_id, claimant_id);
-- An item has at most one approved claim, even if two staff approve at the same moment.
CREATE UNIQUE INDEX IF NOT EXISTS claims_one_approved ON claims (item_id) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS claim_answers_claim_idx ON claim_answers (claim_id);
CREATE INDEX IF NOT EXISTS claim_answers_question_idx ON claim_answers (question_id);
CREATE INDEX IF NOT EXISTS handoffs_claim_idx ON handoffs (claim_id);
CREATE INDEX IF NOT EXISTS handoffs_staff_idx ON handoffs (staff_id);
