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
    const { data: menuData, error: menuErr } = await supabase.from('menus').select('id, name').order('created_at', { ascending: false }).limit(3);
    console.log("Menus:", menuData);
    for (const menu of menuData) {
        const { data, error } = await supabase.from('menu_drinks').select('cocktails(id), beers(id), wines(id)').eq('menu_id', menu.id);
        console.log(`Menu Drinks for ${menu.name}:`, data, "Error:", error);
    }
}
run();
