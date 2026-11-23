-- Study: "Preparation" as a session type, and timed tasks that log their time
-- on a module (and what in it) instead of always as "Other".

-- 1. Allow "preparation" study sessions ("general" stays for the early sessions that use it)
ALTER TABLE public.study_sessions DROP CONSTRAINT IF EXISTS study_sessions_kind_check;
ALTER TABLE public.study_sessions ADD CONSTRAINT study_sessions_kind_check
  CHECK (kind = ANY (ARRAY['general'::text, 'material'::text, 'deadline'::text, 'revision'::text, 'practice'::text, 'preparation'::text, 'other'::text]));

-- 2. A timed Study task's module and "On what" (the clock's value: material:<id>,
--    deadline:<id>, revision, practice, preparation or custom). No module = Other.
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS study_module_id uuid REFERENCES public.study_modules(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS study_what text;
