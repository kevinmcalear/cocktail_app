import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data } = await supabase.from('cocktails').select('id, name').eq('name', 'Too Soon?').single();
    if (!data) return console.log("Too Soon? cocktail not found");
    
    console.log(`To invoke the Edge Function for ${data.name}, run the following curl command:`);
    console.log(`curl -i --request POST 'https://uzrqriixgxbvhunwrwkn.supabase.co/functions/v1/generate-cocktail-image' \\`);
    console.log(`  --header 'Authorization: Bearer ${supabaseKey}' \\`);
    console.log(`  --header 'Content-Type: application/json' \\`);
    console.log(`  --data '{"cocktail_id": "${data.id}"}'`);
}

run();
