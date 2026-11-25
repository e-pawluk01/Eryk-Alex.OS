-- The bank's three lines, kept apart (Eryk, 25 Nov 2026).
--
-- A foreign-currency payment shows on the bank statement as three lines:
-- the purchase, a "non-GBP" fee (2.99%) and a "non-GBP purchase fee" (50p).
-- Merging the two fees into one "bank fee" caused confusion, and "site price"
-- wasn't what was actually paid (the bank's exchange rate differs from the
-- site's). So:
--   items:   site_price -> paid, bank_fee -> non_gbp_fee, + purchase_fee
--   batches: shipping_bank_fee -> shipping_non_gbp_fee, + shipping_purchase_fee
-- Renames keep any rows already typed; an old merged bank fee lands in the
-- non-GBP fee column.

ALTER TABLE public.stock_items RENAME COLUMN site_price TO paid;
ALTER TABLE public.stock_items RENAME COLUMN bank_fee TO non_gbp_fee;
ALTER TABLE public.stock_items ADD COLUMN purchase_fee numeric(10,2);

ALTER TABLE public.stock_batches RENAME COLUMN shipping_bank_fee TO shipping_non_gbp_fee;
ALTER TABLE public.stock_batches ADD COLUMN shipping_purchase_fee numeric(10,2);
