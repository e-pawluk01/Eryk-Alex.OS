-- Remove the long-deprecated "Drink idea" context and the unused goals table
-- (Eryk, 22 Nov 2026: "Goals and anything related to the drink idea can be deleted").
--
-- Permanent: the project is on the Free plan, so there are no backups to restore
-- from. Deleting a "Drink idea" task also deletes its subtasks (tasks.parent_id
-- is ON DELETE CASCADE); study sessions that pointed at one keep their row with
-- task_id cleared (ON DELETE SET NULL), as do tasks filed in a deleted folder.

-- 1. Drink idea rows
DELETE FROM public.tasks WHERE context = 'Drink idea';
DELETE FROM public.events WHERE context = 'Drink idea';
DELETE FROM public.folders WHERE context = 'Drink idea';

-- 2. "Drink idea" is no longer an allowed context
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_context_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_context_check
  CHECK (context = ANY (ARRAY['Eryk'::text, 'Alex'::text, 'Reselling'::text]));

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_context_check;
ALTER TABLE public.events ADD CONSTRAINT events_context_check
  CHECK (context = ANY (ARRAY['Eryk'::text, 'Alex'::text, 'Reselling'::text]));

ALTER TABLE public.folders DROP CONSTRAINT IF EXISTS folders_context_check;
ALTER TABLE public.folders ADD CONSTRAINT folders_context_check
  CHECK (context = ANY (ARRAY['Eryk'::text, 'Alex'::text, 'Reselling'::text]));

-- 3. goals: nothing in the app reads or writes it, and nothing references it
DROP TABLE IF EXISTS public.goals;
