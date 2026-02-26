import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function count() {
    const { count, error } = await supabase.from('cocktails').select('*', { count: 'exact', head: true });
    console.log(`Total cocktails: ${count}`);
}
count();
