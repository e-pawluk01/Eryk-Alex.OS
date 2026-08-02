import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testInsert() {
  const newTask = {
    title: `Upload Short 1 for Test Video`,
    context: 'Eryk',
    domain: 'CONTENT',
    status: 'todo',
    scheduled_date: '2026-08-05'
  };
  
  const { data, error } = await supabase.from('tasks').insert([newTask]).select();
  console.log("Insert result:", { data, error });
}
testInsert();
