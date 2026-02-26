import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function findBeers() {
    const { data: bTable, error: bErr, count } = await supabase.from('beers').select('*', { count: 'exact' });
    console.log(`Total beers: ${count}`);
    if (bTable && bTable.length > 0) {
        console.log("Sample beer data:", bTable[0]);
    }
}
findBeers();
