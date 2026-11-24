-- Add stock: the next item code (1-001, O-001, D-001), from the same counter as
-- SKUs (generate_next_sku), so codes can never repeat.
--
-- generate_next_sku writes to sku_sequences, which has no access rule for
-- signed-in users (only server jobs used it). This wrapper runs with the
-- owner's rights, but only for Eryk and Alex, and only for item-code prefixes
-- (a batch number + "-", "O-" or "D-"), so the app can call it directly.

CREATE FUNCTION public.stock_next_code(prefix text) RETURNS text
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.jwt() ->> 'email', '') <> ALL (ARRAY['erykpawluk@gmail.com', 'alexandra.ap.archive@gmail.com']) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF prefix !~ '^([0-9]+|O|D)-$' THEN
    RAISE EXCEPTION 'Not an item-code prefix: %', prefix;
  END IF;
  RETURN public.generate_next_sku(prefix);
END;
$$;

REVOKE ALL ON FUNCTION public.stock_next_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stock_next_code(text) TO authenticated;

-- Live updates: the Stock page refreshes when Eryk or Alex adds or changes
-- an item or batch (the same realtime feed tasks and events use).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_items, public.stock_batches;
  END IF;
END $$;
