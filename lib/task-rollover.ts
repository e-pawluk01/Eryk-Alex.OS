import type { SupabaseClient } from '@supabase/supabase-js';

// Today's date in the UK, as yyyy-MM-dd.
export const londonToday = (now = new Date()) =>
  now.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });

// The midnight tidy-up for tasks scheduled before today:
//   - not ticked → moved to today
//   - ticked     → deleted
//   - daily      → moved to today and unticked, never deleted
// Safe to run any number of times; it only touches days that have passed.
export async function rolloverTasks(db: SupabaseClient, today = londonToday()) {
  const { data: deleted, error: delError } = await db
    .from('tasks').delete()
    .lt('scheduled_date', today).eq('status', 'done').or('is_daily.is.null,is_daily.eq.false')
    .select('id');
  if (delError) throw delError;

  const { data: moved, error: moveError } = await db
    .from('tasks').update({ scheduled_date: today })
    .lt('scheduled_date', today).eq('status', 'todo')
    .select('id');
  if (moveError) throw moveError;

  const { data: reset, error: dailyError } = await db
    .from('tasks').update({ scheduled_date: today, status: 'todo', progress: 0 })
    .lt('scheduled_date', today).eq('status', 'done').eq('is_daily', true)
    .select('id');
  if (dailyError) throw dailyError;

  return { deleted: deleted?.length ?? 0, moved: moved?.length ?? 0, reset: reset?.length ?? 0 };
}
