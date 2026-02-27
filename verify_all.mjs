import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAll() {
    const { data, error } = await supabase
        .from('ingredients')
        .select(`
            id,
            name,
            ingredient_images (
                id
            ),
            subIngredients:ingredient_components!parent_ingredient_id (
                ingredient:child_ingredient_id (
                    name
                )
            )
        `);
    
    if (error) {
        console.error("Error fetching:", error);
        return;
    }

    const missing = data.filter(i => !i.ingredient_images || i.ingredient_images.length === 0);
    console.log(`Total ingredients: ${data.length}`);
    console.log(`Ingredients missing images: ${missing.length}`);
    
    if (missing.length > 0) {
        console.log("Missing ingredients:");
        missing.slice(0, 10).forEach(m => console.log(`- ${m.name}`));
    }
}

checkAll();
