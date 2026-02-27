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
    const { data: menuData } = await supabase.from('menus').select('id, name, template_id').eq('name', 'February 2026');
    console.log("Feb 2026:", menuData);
}
run();
