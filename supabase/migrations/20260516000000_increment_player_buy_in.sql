CREATE OR REPLACE FUNCTION increment_player_buy_in(player_id uuid)
RETURNS TABLE (id uuid, name text, total_buy_ins integer, final_chips numeric, created_at timestamptz)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE players
  SET total_buy_ins = players.total_buy_ins + 1
  WHERE players.id = player_id
  RETURNING players.id, players.name, players.total_buy_ins, players.final_chips, players.created_at;
END;
$$;
