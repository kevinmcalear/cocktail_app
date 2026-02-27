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
    const { data, error } = await supabase.from('menu_drinks').select(`
        template_section_id,
        sort_order,
        cocktails ( id, name ),
        beers ( id, name ),
        wines ( id, name )
    `).limit(3);
    console.log("Error:", error);
    console.log("Data:", JSON.stringify(data, null, 2));
}
run();
