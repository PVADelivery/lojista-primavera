import { supabase } from './src/lib/supabase'; async function run() { const { data, error } = await supabase.rpc('get_policies'); console.log(data, error); } run();  
