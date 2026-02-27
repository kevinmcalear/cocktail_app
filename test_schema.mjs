import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const envFile = fs.readFileSync('.env', 'utf-8');
const lines = envFile.split('\n');
let url = '', key = '';
lines.forEach(line => {
    if (line.startsWith('EXPO_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '').trim();
    if (line.startsWith('EXPO_PUBLIC_SUPABASE_ANON_KEY=')) key = line.split('=')[1].replace(/"/g, '').trim();
});
const supabase = createClient(url, key);
async function run() {
    const { data: b } = await supabase.from('beers').select('*').limit(1);
    const { data: w } = await supabase.from('wines').select('*').limit(1);
    console.log("Beers keys:", Object.keys(b?.[0] || {}));
    console.log("Wines keys:", Object.keys(w?.[0] || {}));
}
run();
