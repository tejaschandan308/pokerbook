-- New RPC that adjusts a player's buy-in count by an arbitrary delta (+1 or -1).
-- Enforces a minimum of 1 via GREATEST so the DB can never go below 1.
-- Validates host PIN if the session has one (same pattern as increment_player_buy_in).
-- DROP first because CREATE OR REPLACE cannot change a return type signature.
DROP FUNCTION IF EXISTS adjust_player_buy_in(uuid, integer, text);

CREATE FUNCTION adjust_player_buy_in(
  player_id uuid,
  p_delta integer,
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
  SET total_buy_ins = GREATEST(1, players.total_buy_ins + p_delta)
  WHERE players.id = player_id
  RETURNING players.id, players.name, players.total_buy_ins, players.final_chips, players.created_at;
END;
$$;
