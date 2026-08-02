import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('domain', 'CONTENT')
    .ilike('title', '%Upload Short%')
    .order('created_at', { ascending: false });
  console.log("Tasks found:", data?.length);
  if (data?.length > 0) {
    console.log(data.slice(0, 5));
  } else {
    console.log(error);
  }
}
checkTasks();
