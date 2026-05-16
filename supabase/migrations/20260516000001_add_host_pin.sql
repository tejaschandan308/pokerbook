-- host_pin is nullable so existing sessions without a PIN still work
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS host_pin TEXT;
