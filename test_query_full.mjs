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
                    cocktails (
                        id, name, description,
                        cocktail_images (
                            images ( url )
                        ),
                        recipes (
                            ingredient_amount, ingredient_ml, ingredient_bsp,
                            ingredients!recipes_ingredient_id_fkey ( name )
                        )
                    ),
                    beers (
                        id, name, description, price,
                        beer_images ( images ( url ) )
                    ),
                    wines (
                        id, name, description, price, varietal, region,
                        wine_images ( images ( url ) )
                    )
                `).limit(1);
    console.log("Error:", error);
}
run();
