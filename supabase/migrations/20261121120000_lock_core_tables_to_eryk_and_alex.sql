-- Lock tasks, events, goals and study_topics to Eryk and Alex.
--
-- Before: each table had "Enable read/write access for all" policies with
-- USING (true) and no role, so anyone holding the public anon key could read
-- and change every row. The "Shared Work …" policies also had no role, so the
-- anon key could reach every Reselling / Drink idea row even without them.
--
-- After: one rule per table, the same as work_sessions: signed in, and the
-- email in the token is Eryk's or Alex's. Server jobs use the service role
-- key, which skips RLS, so they are unaffected.
--
-- The "Private Study …" policies are dropped as well: they only ever allowed
-- a subset of what the new rule allows (Postgres ORs permissive policies), and
-- the app keeps Study private by filtering on context, not through RLS.

-- tasks
DROP POLICY IF EXISTS "Enable read access for all" ON public.tasks;
DROP POLICY IF EXISTS "Enable write access for all" ON public.tasks;
DROP POLICY IF EXISTS "Private Study Tasks" ON public.tasks;
DROP POLICY IF EXISTS "Shared Work Tasks" ON public.tasks;
CREATE POLICY "Eryk and Alex can manage tasks" ON public.tasks
  TO authenticated
  USING ((auth.jwt() ->> 'email') = ANY (ARRAY['erykpawluk@gmail.com', 'alexandra.ap.archive@gmail.com']))
  WITH CHECK ((auth.jwt() ->> 'email') = ANY (ARRAY['erykpawluk@gmail.com', 'alexandra.ap.archive@gmail.com']));

-- events
DROP POLICY IF EXISTS "Enable read access for all" ON public.events;
DROP POLICY IF EXISTS "Enable write access for all" ON public.events;
DROP POLICY IF EXISTS "Private Study Events" ON public.events;
DROP POLICY IF EXISTS "Shared Work Events" ON public.events;
CREATE POLICY "Eryk and Alex can manage events" ON public.events
  TO authenticated
  USING ((auth.jwt() ->> 'email') = ANY (ARRAY['erykpawluk@gmail.com', 'alexandra.ap.archive@gmail.com']))
  WITH CHECK ((auth.jwt() ->> 'email') = ANY (ARRAY['erykpawluk@gmail.com', 'alexandra.ap.archive@gmail.com']));

-- goals
DROP POLICY IF EXISTS "Enable read access for all" ON public.goals;
DROP POLICY IF EXISTS "Enable write access for all" ON public.goals;
DROP POLICY IF EXISTS "Private Study Goals" ON public.goals;
DROP POLICY IF EXISTS "Shared Work Goals" ON public.goals;
CREATE POLICY "Eryk and Alex can manage goals" ON public.goals
  TO authenticated
  USING ((auth.jwt() ->> 'email') = ANY (ARRAY['erykpawluk@gmail.com', 'alexandra.ap.archive@gmail.com']))
  WITH CHECK ((auth.jwt() ->> 'email') = ANY (ARRAY['erykpawluk@gmail.com', 'alexandra.ap.archive@gmail.com']));

-- study_topics
DROP POLICY IF EXISTS "Enable read access for all on study_topics" ON public.study_topics;
DROP POLICY IF EXISTS "Enable write access for all on study_topics" ON public.study_topics;
CREATE POLICY "Eryk and Alex can manage study topics" ON public.study_topics
  TO authenticated
  USING ((auth.jwt() ->> 'email') = ANY (ARRAY['erykpawluk@gmail.com', 'alexandra.ap.archive@gmail.com']))
  WITH CHECK ((auth.jwt() ->> 'email') = ANY (ARRAY['erykpawluk@gmail.com', 'alexandra.ap.archive@gmail.com']));
