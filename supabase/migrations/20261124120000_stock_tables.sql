-- Stock tables: the reselling pipeline moves from the Google Sheet into Supabase.
--
-- 11 new tables (all named stock_…) plus a few new columns on the existing
-- analytics_monthly_snapshots. Agreed with Eryk on 24 Nov 2026; the full
-- reasoning lives in .claude/plans/stock-pipeline-decisions.md and the
-- "OS Stock Flow" artifact (Tables section).
--
-- Conventions copied from the live database: uuid ids, text values, "person"
-- for Eryk / Alex, created_at timestamps, and the same access rule as
-- work_sessions (signed in with Eryk's or Alex's email). Server jobs use the
-- service role key, which skips the rule.
--
-- Money is numeric(10,2) in pounds. Things that can be worked out from other
-- columns (batch totals, loss, profit, days to sell, Floor up) are NOT stored,
-- so they can never disagree with the numbers they come from.
--
-- Nothing reads these tables yet: the app keeps using the sheet until the
-- stock tab is built on top of them.


-- ============================================================
-- Lookup tables: categories, platforms, settings
-- ============================================================

-- One row per category. Added or retired in Settings, no code change.
-- A retired category stays on its old items; a SKU code is never reused.
CREATE TABLE public.stock_categories (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL UNIQUE,
  sku_code      text NOT NULL UNIQUE,          -- 2 letters, e.g. DR
  colour        text,
  measurements  text[] NOT NULL DEFAULT '{}',  -- what to measure, in order
  size_chart    text,                          -- size-chart template for listings
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- One row per place we sell. Added in Settings; switched off, never deleted,
-- so old sales and listings keep pointing at it.
CREATE TABLE public.stock_platforms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  active      boolean NOT NULL DEFAULT true,
  prompt      text,                            -- AI prompt for title + description
  template    jsonb NOT NULL DEFAULT '{}',     -- {policy, hashtags}
  fee_rule    jsonb NOT NULL DEFAULT '{}',     -- how its selling fee is worked out
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Single values only, one row each: AI model, floor markup, price-suggestion
-- rules, stage timings, condition list, proxies.
CREATE TABLE public.stock_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- Batches and items
-- ============================================================

-- One row per Neokyo parcel.
-- Worked out, not stored: item count, total cost, extras rate, loss.
CREATE TABLE public.stock_batches (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number             integer NOT NULL UNIQUE,
  proxy              text NOT NULL DEFAULT 'Neokyo',
  status             text NOT NULL DEFAULT 'collecting'
                       CHECK (status IN ('collecting', 'shipped', 'arrived', 'checked', 'lost')),
  started_on         date NOT NULL DEFAULT current_date,
  shipped_on         date,
  arrived_on         date,
  lost_on            date,
  shipping_paid      numeric(10,2),
  shipping_bank_fee  numeric(10,2),
  carrier            text,
  tracking           text,
  customs            numeric(10,2),
  other_costs        numeric(10,2),
  late_customs       jsonb NOT NULL DEFAULT '[]', -- [{amount, date}] bills that came after delivery
  refund             numeric(10,2),               -- lost parcel only
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- One row per item, for its whole life (order to sale).
-- Worked out, not stored: loss, days live, Floor up.
CREATE TABLE public.stock_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,          -- 6-004, O-001, D-001
  sku             text UNIQUE,                   -- given at Generate
  source          text NOT NULL CHECK (source IN ('imported', 'online', 'donated')),
  batch_id        uuid REFERENCES public.stock_batches(id),
  name            text NOT NULL,
  brand           text,
  category_id     uuid REFERENCES public.stock_categories(id),
  link            text,
  bought_on       text,                          -- the marketplace / shop it came from
  site_price      numeric(10,2),
  bank_fee        numeric(10,2),
  item_cost       numeric(10,2),                 -- set once, at the arrival check
  floor_price     numeric(10,2),                 -- set once, at the check (raised by a late customs bill)
  status          text NOT NULL DEFAULT 'paid'
                    CHECK (status IN ('paid', 'in_transit', 'to_check', 'prep', 'photos', 'generate',
                                      'upload', 'live', 'taken_down', 'sold',
                                      'kept', 'damaged', 'lost', 'removed')),
  needs_steam     boolean NOT NULL DEFAULT false,
  steam_done      boolean NOT NULL DEFAULT false,
  needs_repair    boolean NOT NULL DEFAULT false,
  repair_done     boolean NOT NULL DEFAULT false,
  needs_measure   boolean NOT NULL DEFAULT false,
  measure_done    boolean NOT NULL DEFAULT false,
  size            text,
  condition       text,
  measurements    jsonb NOT NULL DEFAULT '{}',   -- {"Pit to pit": 46, "Length": 92}
  notes           text,
  listed_price    numeric(10,2),                 -- never changes after upload
  est_sale        numeric(10,2),
  current_price   numeric(10,2),                 -- the one that drops
  stage           text CHECK (stage IN ('1', '2', '3', 'floor')),
  stage_date      date,
  on_hold         boolean NOT NULL DEFAULT false,
  paused_on       date,                          -- down everywhere: the clock stops
  date_added      date,                          -- arrival / added; the report's "bought" date
  exit_date       date,
  exit_reason     text CHECK (exit_reason IN ('sold', 'kept', 'damaged', 'lost', 'removed')),
  kept_by         text CHECK (kept_by IN ('Eryk', 'Alex')),
  invoice_paid    boolean,
  damaged_where   text CHECK (damaged_where IN ('warehouse', 'arrival')),
  refund          numeric(10,2),                 -- damaged item: lowers its loss
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_items_batch_idx    ON public.stock_items (batch_id);
CREATE INDEX stock_items_category_idx ON public.stock_items (category_id);
CREATE INDEX stock_items_status_idx   ON public.stock_items (status);

-- One row each time an item goes up on a platform. A reupload is a new row,
-- so the history stays. down_on is empty while it is live there.
CREATE TABLE public.stock_item_platforms (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id      uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  platform_id  uuid NOT NULL REFERENCES public.stock_platforms(id),
  up_on        date NOT NULL DEFAULT current_date,
  down_on      date,
  down_reason  text CHECK (down_reason IN ('sold_here', 'sold_elsewhere', 'taken_down', 'removed')),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_item_platforms_item_idx ON public.stock_item_platforms (item_id);


-- ============================================================
-- Selling: bundles, sales, stage changes, listings
-- ============================================================

-- One row per bundle sale. Each item's sale row points here and holds its share.
CREATE TABLE public.stock_bundles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text NOT NULL UNIQUE,            -- B-07
  total        numeric(10,2) NOT NULL,
  platform_id  uuid REFERENCES public.stock_platforms(id),
  fees         numeric(10,2),
  shipping     numeric(10,2),
  offer        text,                            -- offer or counter
  sold_on      date NOT NULL DEFAULT current_date,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- One row per sale. A return keeps its row (returned_on), so the item can sell again.
-- Worked out, not stored: profit, days to sell.
CREATE TABLE public.stock_sales (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id        uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  sold_price     numeric(10,2) NOT NULL,         -- in a bundle: this item's share
  platform_id    uuid REFERENCES public.stock_platforms(id),
  fees           numeric(10,2),
  shipping       numeric(10,2),
  how_sold       text,                           -- listed price, offer, counter…
  stage_at_sale  text,
  bundle_id      uuid REFERENCES public.stock_bundles(id),
  sold_on        date NOT NULL DEFAULT current_date,
  returned_on    date,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_sales_item_idx    ON public.stock_sales (item_id);
CREATE INDEX stock_sales_bundle_idx  ON public.stock_sales (bundle_id);
CREATE INDEX stock_sales_sold_on_idx ON public.stock_sales (sold_on);

-- One row each time the stage pop-up is saved.
CREATE TABLE public.stock_stage_changes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  stage         text NOT NULL CHECK (stage IN ('1', '2', '3', 'floor')),
  changed_on    date NOT NULL DEFAULT current_date,
  price_before  numeric(10,2),
  price_after   numeric(10,2),
  new_title     boolean NOT NULL DEFAULT false,
  new_cover     boolean NOT NULL DEFAULT false,
  person        text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_stage_changes_item_idx ON public.stock_stage_changes (item_id);

-- What Generate wrote, per platform. Regenerating adds a new row and keeps the old one.
CREATE TABLE public.stock_listings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id      uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  platform_id  uuid NOT NULL REFERENCES public.stock_platforms(id),
  title        text,
  description  text,
  model        text,
  failed       boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_listings_item_idx ON public.stock_listings (item_id);


-- ============================================================
-- Log: every change, written by the database itself
-- ============================================================

CREATE TABLE public.stock_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid REFERENCES public.stock_items(id) ON DELETE CASCADE,
  batch_id    uuid REFERENCES public.stock_batches(id) ON DELETE CASCADE,
  what        text NOT NULL,                   -- column name, or "created" / "sale.returned_on" …
  from_value  text,
  to_value    text,
  who         text NOT NULL,                   -- signed-in email, or "system" for server jobs
  note        text,                            -- the app may add a short note
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_log_item_idx  ON public.stock_log (item_id, created_at DESC);
CREATE INDEX stock_log_batch_idx ON public.stock_log (batch_id, created_at DESC);

-- Writes one log row per changed column on items, batches and sales.
-- A new row is logged once as "created".
CREATE FUNCTION public.stock_write_log() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  who     text := coalesce(auth.jwt() ->> 'email', 'system');
  item    uuid;
  batch   uuid;
  prefix  text := '';
  col     record;
BEGIN
  IF TG_TABLE_NAME = 'stock_items' THEN
    item := NEW.id;
  ELSIF TG_TABLE_NAME = 'stock_batches' THEN
    batch := NEW.id;
  ELSE -- stock_sales
    item := NEW.item_id;
    prefix := 'sale.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.stock_log (item_id, batch_id, what, who)
    VALUES (item, batch, prefix || 'created', who);
    RETURN NEW;
  END IF;

  FOR col IN
    SELECT n.key, o.value AS old_v, n.value AS new_v
    FROM jsonb_each(to_jsonb(NEW)) n
    JOIN jsonb_each(to_jsonb(OLD)) o USING (key)
    WHERE n.value IS DISTINCT FROM o.value AND n.key NOT IN ('id', 'created_at')
  LOOP
    INSERT INTO public.stock_log (item_id, batch_id, what, from_value, to_value, who)
    VALUES (item, batch, prefix || col.key, col.old_v #>> '{}', col.new_v #>> '{}', who);
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER stock_items_log   AFTER INSERT OR UPDATE ON public.stock_items   FOR EACH ROW EXECUTE FUNCTION public.stock_write_log();
CREATE TRIGGER stock_batches_log AFTER INSERT OR UPDATE ON public.stock_batches FOR EACH ROW EXECUTE FUNCTION public.stock_write_log();
CREATE TRIGGER stock_sales_log   AFTER INSERT OR UPDATE ON public.stock_sales   FOR EACH ROW EXECUTE FUNCTION public.stock_write_log();


-- ============================================================
-- Monthly snapshots: extended, not replaced
-- ============================================================

ALTER TABLE public.analytics_monthly_snapshots
  ADD COLUMN IF NOT EXISTS avg_days_to_sell numeric,
  ADD COLUMN IF NOT EXISTS by_category      jsonb,   -- per category: sold, revenue, profit, days to sell
  ADD COLUMN IF NOT EXISTS stock_counts     jsonb,   -- how many items in each status at month end
  ADD COLUMN IF NOT EXISTS losses           numeric; -- damaged + lost, after refunds


-- ============================================================
-- Access: the same rule as work_sessions, on every stock table
-- ============================================================

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['stock_categories', 'stock_platforms', 'stock_settings', 'stock_batches',
                           'stock_items', 'stock_item_platforms', 'stock_bundles', 'stock_sales',
                           'stock_stage_changes', 'stock_listings', 'stock_log']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY "Eryk and Alex can manage %s" ON public.%I TO authenticated '
      'USING ((auth.jwt() ->> ''email'') = ANY (ARRAY[''erykpawluk@gmail.com'', ''alexandra.ap.archive@gmail.com''])) '
      'WITH CHECK ((auth.jwt() ->> ''email'') = ANY (ARRAY[''erykpawluk@gmail.com'', ''alexandra.ap.archive@gmail.com'']))',
      replace(t, '_', ' '), t);
  END LOOP;
END $$;


-- ============================================================
-- Starting rows
-- ============================================================

-- The app's 15 categories (lib/sku-categories.ts) with what each one measures.
INSERT INTO public.stock_categories (name, sku_code, measurements) VALUES
  ('Outerwear',            'OU', ARRAY['Pit to pit', 'Length', 'Bust']),
  ('Jumpers & Sweaters',   'JU', ARRAY['Pit to pit', 'Length']),
  ('Suits & Blazers',      'SB', ARRAY['Pit to pit', 'Length']),
  ('Dresses',              'DR', ARRAY['Pit to pit', 'Length', 'Bust', 'Sleeve length']),
  ('Skirts',               'SK', ARRAY['Waist', 'Length']),
  ('Tops & t-shirts',      'TO', ARRAY['Pit to pit', 'Length']),
  ('Blouses',              'BL', ARRAY['Pit to pit', 'Length']),
  ('Jeans',                'JS', ARRAY['Waist', 'Inseam']),
  ('Trousers',             'TR', ARRAY['Waist', 'Inseam']),
  ('Shorts',               'ST', ARRAY['Waist', 'Inseam']),
  ('Lingerie & nightwear', 'LN', '{}'),
  ('Activewear',           'AC', '{}'),
  ('Shoes',                'SH', '{}'),
  ('Bags',                 'BA', ARRAY['Width', 'Height', 'Length']),
  ('Accessories',          'AS', '{}');

-- The three platforms we sell on today. Prompts are copied in from the app when
-- the Settings screen is built.
INSERT INTO public.stock_platforms (name) VALUES ('Vinted'), ('Depop'), ('eBay');

-- Today's rules (lib/listing-ladder.ts and the mockup's Settings).
INSERT INTO public.stock_settings (key, value) VALUES
  ('floor_markup',  '0.30'),
  ('stage_timings', '{"start_days": 28, "stage1": 1, "stage2": 0.5, "stage3": 0.5, "checkin": 1, "floor_check": 2}'),
  ('conditions',    '["New with tags", "Like new", "Very good", "Good"]'),
  ('proxies',       '["Neokyo"]');
