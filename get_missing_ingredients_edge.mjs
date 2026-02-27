import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import fs from "fs";
dotenv.config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function checkMissing() {
    console.log("Fetching ingredients...");
    const { data: ingredients, error } = await supabase
        .from('ingredients')
        .select(`
            id,
            name,
            ingredient_images ( id )
        `)
        .order('name', { ascending: true });

    if (error) {
        console.error("Error fetching ingredients:", error);
        return;
    }

    const missing = ingredients.filter(i => !i.ingredient_images || i.ingredient_images.length === 0);

    console.log(`\nTotal missing: ${missing.length}`);
    fs.writeFileSync('missing_ingredients.json', JSON.stringify(missing, null, 2));
    console.log("Saved to missing_ingredients.json");
    
    console.log("First 5 missing:");
    const nextBatch = missing.slice(0, 5);
    console.log(nextBatch.map(i => i.name).join(', '));
}

checkMissing();
