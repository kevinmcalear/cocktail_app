import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    const names = ["Angostura", "Angostura Bitters", "Aperol", "Aperol Fizz Batch", "Applejack"];
    
    console.log("Verifying ingredients in database...");
    
    const { data, error } = await supabase
        .from('ingredients')
        .select(`
            name,
            ingredient_images (
                images (
                    id,
                    url
                )
            )
        `)
        .in('name', names);
        
    if (error) {
        console.error("Error:", error);
        return;
    }
    
    console.log(JSON.stringify(data, null, 2));
}

verify();
