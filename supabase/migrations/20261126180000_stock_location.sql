-- Location: who has the piece at home, Eryk or Alex (Eryk's sketch, 26 Nov 2026).
-- Shown at the top of an item's Details tab while it's physically with one of
-- you (not while paid / in transit / to check, not once it has left), and changed
-- with one tap. Empty until someone sets it. The existing history trigger
-- records each change ("Location: Eryk → Alex").

ALTER TABLE public.stock_items
  ADD COLUMN location text CHECK (location IN ('Eryk', 'Alex'));
