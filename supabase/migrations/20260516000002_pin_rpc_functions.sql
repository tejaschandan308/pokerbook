-- Replace increment_player_buy_in to require PIN for sessions that have one.
-- p_pin DEFAULT NULL means old callers without the argument still work for
-- sessions that have no host_pin (backwards compatible).
CREATE OR REPLACE FUNCTION increment_player_buy_in(
  player_id uuid,
  p_pin text DEFAULT NULL
)
RETURNS TABLE (id uuid, name text, total_buy_ins integer, final_chips numeric, created_at timestamptz)
LANGUAGE plpgsql
AS $$
DECLARE
  stored_pin text;
  sess_id uuid;
BEGIN
  SELECT session_id INTO sess_id FROM players WHERE players.id = player_id;
  SELECT host_pin INTO stored_pin FROM sessions WHERE sessions.id = sess_id;

  IF stored_pin IS NOT NULL AND (p_pin IS NULL OR stored_pin != p_pin) THEN
    RAISE EXCEPTION 'invalid pin';
  END IF;

  RETURN QUERY
  UPDATE players
  SET total_buy_ins = players.total_buy_ins + 1
  WHERE players.id = player_id
  RETURNING players.id, players.name, players.total_buy_ins, players.final_chips, players.created_at;
END;
$$;

-- Returns true if the session has a host_pin set (safe to expose — no PIN value).
CREATE OR REPLACE FUNCTION session_has_pin(p_session_id uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  result boolean;
BEGIN
  SELECT (host_pin IS NOT NULL) INTO result FROM sessions WHERE id = p_session_id;
  RETURN COALESCE(result, false);
END;
$$;

-- Returns true when the supplied PIN matches the session's host_pin,
-- or when the session has no host_pin at all.
CREATE OR REPLACE FUNCTION verify_session_pin(p_session_id uuid, p_pin text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  stored_pin text;
BEGIN
  SELECT host_pin INTO stored_pin FROM sessions WHERE id = p_session_id;
  IF stored_pin IS NULL THEN
    RETURN true;
  END IF;
  RETURN stored_pin = p_pin;
END;
$$;

-- Insert a player, validating PIN first.
CREATE OR REPLACE FUNCTION add_player_with_pin(
  p_session_id uuid,
  p_pin text,
  p_name text
)
RETURNS TABLE (id uuid, name text, total_buy_ins integer, final_chips numeric, created_at timestamptz)
LANGUAGE plpgsql
AS $$
DECLARE
  stored_pin text;
BEGIN
  SELECT host_pin INTO stored_pin FROM sessions WHERE sessions.id = p_session_id;
  IF stored_pin IS NOT NULL AND (p_pin IS NULL OR stored_pin != p_pin) THEN
    RAISE EXCEPTION 'invalid pin';
  END IF;

  RETURN QUERY
  INSERT INTO players (session_id, name, total_buy_ins)
  VALUES (p_session_id, p_name, 1)
  RETURNING players.id, players.name, players.total_buy_ins, players.final_chips, players.created_at;
END;
$$;

-- Update a player's chip counts, validating PIN first.
CREATE OR REPLACE FUNCTION update_player_with_pin(
  p_player_id uuid,
  p_session_id uuid,
  p_pin text,
  p_total_buy_ins integer,
  p_final_chips numeric
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  stored_pin text;
BEGIN
  SELECT host_pin INTO stored_pin FROM sessions WHERE sessions.id = p_session_id;
  IF stored_pin IS NOT NULL AND (p_pin IS NULL OR stored_pin != p_pin) THEN
    RAISE EXCEPTION 'invalid pin';
  END IF;

  UPDATE players
  SET final_chips = p_final_chips, total_buy_ins = p_total_buy_ins
  WHERE players.id = p_player_id AND players.session_id = p_session_id;
END;
$$;

-- Mark the session as ended, validating PIN first.
CREATE OR REPLACE FUNCTION end_session_with_pin(
  p_session_id uuid,
  p_pin text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  stored_pin text;
BEGIN
  SELECT host_pin INTO stored_pin FROM sessions WHERE sessions.id = p_session_id;
  IF stored_pin IS NOT NULL AND (p_pin IS NULL OR stored_pin != p_pin) THEN
    RAISE EXCEPTION 'invalid pin';
  END IF;

  UPDATE sessions
  SET status = 'ended', ended_at = NOW()
  WHERE sessions.id = p_session_id;
END;
$$;
