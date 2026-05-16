-- players.final_chips is integer in the actual table, not numeric.
-- CREATE OR REPLACE cannot change a return type, so we drop first.

DROP FUNCTION IF EXISTS increment_player_buy_in(uuid, text);
DROP FUNCTION IF EXISTS increment_player_buy_in(uuid);

CREATE FUNCTION increment_player_buy_in(
  player_id uuid,
  p_pin text DEFAULT NULL
)
RETURNS TABLE (id uuid, name text, total_buy_ins integer, final_chips integer, created_at timestamptz)
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

DROP FUNCTION IF EXISTS add_player_with_pin(uuid, text, text);

CREATE FUNCTION add_player_with_pin(
  p_session_id uuid,
  p_pin text,
  p_name text
)
RETURNS TABLE (id uuid, name text, total_buy_ins integer, final_chips integer, created_at timestamptz)
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
