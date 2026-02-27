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
    const { data: menuData } = await supabase.from('menus').select('id, name, template_id').eq('name', 'February 2026').limit(1).single();
    const { data: drinksData } = await supabase.from('menu_drinks').select('cocktail_id, beer_id, wine_id, template_section_id').eq('menu_id', menuData.id);
    const { data: sectionsData } = await supabase.from('template_sections').select('id, name').eq('template_id', menuData.template_id);
    console.log("Sections attached to February 2026's template:", sectionsData);
    console.log("Drinks inside February 2026:", drinksData);
}
run();
