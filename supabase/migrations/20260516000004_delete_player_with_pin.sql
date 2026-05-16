-- delete_player_with_pin: deletes a player and their buy-ins from a session.
-- PIN is validated when the session has one.
-- Table bank recalculates automatically since it's derived from remaining players' buy-ins.
CREATE OR REPLACE FUNCTION delete_player_with_pin(
  p_player_id uuid,
  p_session_id uuid,
  p_pin text DEFAULT NULL
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

  DELETE FROM players
  WHERE players.id = p_player_id AND players.session_id = p_session_id;
END;
$$;

-- Enable full replica identity so realtime DELETE events include session_id for filtering.
ALTER TABLE players REPLICA IDENTITY FULL;
