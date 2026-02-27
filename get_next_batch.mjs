import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function getNextBatch() {
    // We get ingredients that don't have images yet
    const { data: missing, error } = await supabase
        .from('ingredients')
        .select(`
            id,
            name,
            ingredient_images ( id )
        `)
        .order('name');
        
    if (error) {
        console.error(error);
        return;
    }
    
    const trulyMissing = missing.filter(i => !i.ingredient_images || i.ingredient_images.length === 0);
    const nextFive = trulyMissing.slice(0, 5);
    
    // For each, get sub-ingredients
    for (const ing of nextFive) {
        const { data: recipe } = await supabase
            .from('recipes')
            .select(`
                ingredient:ingredients!recipes_ingredient_id_fkey(name)
            `)
            .eq('parent_ingredient_id', ing.id);
            
        ing.subIngredients = recipe ? recipe.map(r => r.ingredient?.name).filter(Boolean) : [];
    }
    
    console.log(JSON.stringify(nextFive, null, 2));
}

getNextBatch();
