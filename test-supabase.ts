import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
    const { data, error } = await supabase.from('app_item_presentation').select(`
        id, 
        name, 
        app_recipe_presentation!recipe_item_id(
            ingredient_item_id,
            display_ingredient_id,
            ingredient:app_item_presentation!ingredient_item_id(
                name
            )
        )
    `).limit(1);
    console.log('Error:', error);
}
test();
