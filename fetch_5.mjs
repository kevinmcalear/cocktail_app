import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchCocktails() {
    const { data: cocktails, error } = await supabase
        .from('cocktails')
        .select(`
            name,
            garnish_1,
            spec,
            method:methods(name),
            glassware:glassware(name),
            ice:ice(name),
            recipes(
                ingredient_amount,
                ingredient_ml,
                ingredient_dash,
                ingredient:ingredients!recipes_ingredient_id_fkey(name)
            )
        `)
        .range(55, 59);

    if (error) {
        console.error("Error fetching cocktails:", error);
        return;
    }

    // try fetching ice separately if ice is somehow linked. 
    // Usually ice might be in spec or notes. Let's see if ice is in the db.
    for (const c of cocktails) {
        console.log(`\nCocktail: ${c.name}`);
        console.log(`Glassware: ${c.glassware ? c.glassware.name : 'Unknown'}`);
        console.log(`Method: ${c.method ? c.method.name : 'Unknown'}`);
        console.log(`Garnish: ${c.garnish_1 || 'None'}`);
        console.log(`Spec/Ice: ${c.spec || 'None'} / ${c.ice ? c.ice.name : 'Unknown'}`);
        
        console.log(`Ingredients:`);
        if (c.recipes) {
            c.recipes.forEach(r => {
                let amt = [];
                if (r.ingredient_amount) amt.push(`${r.ingredient_amount} oz`);
                if (r.ingredient_ml) amt.push(`${r.ingredient_ml} ml`);
                if (r.ingredient_dash) amt.push(`${r.ingredient_dash} dash`);
                
                console.log(`  - ${amt.join(' / ')} ${r.ingredient ? r.ingredient.name : ''}`);
            });
        }
    }
}

fetchCocktails();
