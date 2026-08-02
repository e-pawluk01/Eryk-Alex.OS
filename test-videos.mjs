import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkAll() {
  const { data, error } = await supabase.from('videos').select('id, title, stage, shorts_target, scheduled_date');
  console.log("All videos:", data);
}
checkAll();
