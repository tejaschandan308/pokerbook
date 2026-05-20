ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS short_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS sessions_short_code_unique_idx
ON sessions (short_code)
WHERE short_code IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sessions_short_code_format'
  ) THEN
    ALTER TABLE sessions
    ADD CONSTRAINT sessions_short_code_format
    CHECK (short_code IS NULL OR short_code ~ '^[A-Za-z0-9]{8}$');
  END IF;
END $$;
