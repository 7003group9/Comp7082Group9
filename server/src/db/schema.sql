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
  location            TEXT,                     -- finder's description of the spot
  building            TEXT,                     -- campus building, optional (BUILDINGS in itemValidation.js)
  latitude            DOUBLE PRECISION CHECK (latitude BETWEEN -90 AND 90),     -- GPS pin, optional
  longitude           DOUBLE PRECISION CHECK (longitude BETWEEN -180 AND 180),
  status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claim pending', 'claimed', 'dropped off', 'handed off')),  -- claimed = a claim was approved; dropped off = the finder left it at Campus Security
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),  -- when it was posted
  claimed_at          TIMESTAMPTZ                          -- when a claim was approved; the feed hides it 24h later
);
-- CREATE TABLE IF NOT EXISTS skips tables that already exist, so older
-- databases are updated here: the "ID, card, wallet or phone" flag was removed,
-- the building column was added, and the status check gains 'claimed' and 'dropped off'.
ALTER TABLE items DROP COLUMN IF EXISTS is_sensitive;
ALTER TABLE items ADD COLUMN IF NOT EXISTS building TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
UPDATE items SET claimed_at = now() WHERE status = 'claimed' AND claimed_at IS NULL; -- claimed before the column existed
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_status_check;
ALTER TABLE items ADD CONSTRAINT items_status_check
  CHECK (status IN ('open', 'claim pending', 'claimed', 'dropped off', 'handed off'));

-- PRIVATE: expected_answer never leaves the server. Only the question text is
-- shown, to a logged-in claimant on the claim form.
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
  data       JSONB NOT NULL,  -- { title, location, latitude, longitude, category, questions }
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
-- One try per item: a person can only ever claim the same item once, even if rejected.
CREATE UNIQUE INDEX IF NOT EXISTS claims_one_per_user ON claims (item_id, claimant_id);
-- An item has at most one approved claim, even if two staff approve at the same moment.
CREATE UNIQUE INDEX IF NOT EXISTS claims_one_approved ON claims (item_id) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS claim_answers_claim_idx ON claim_answers (claim_id);
CREATE INDEX IF NOT EXISTS claim_answers_question_idx ON claim_answers (question_id);
CREATE INDEX IF NOT EXISTS handoffs_claim_idx ON handoffs (claim_id);
CREATE INDEX IF NOT EXISTS handoffs_staff_idx ON handoffs (staff_id);
