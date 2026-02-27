import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import fs from "fs";
dotenv.config();

const SUPABASE_UPLOAD_URL = "https://uzrqriixgxbvhunwrwkn.supabase.co/functions/v1/upload-image";
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseClient = createClient(supabaseUrl, supabaseKey);

const ingredients = [
    { name: "White Rum", file: "/Users/kevinmcalear/.gemini/antigravity/brain/c422c0b1-0cca-41a7-b3ab-aeabb9e0e5e5/white_rum_ingredient_1772149196787.png" },
    { name: "Wonder Foam", file: "/Users/kevinmcalear/.gemini/antigravity/brain/c422c0b1-0cca-41a7-b3ab-aeabb9e0e5e5/wonder_foam_ingredient_1772149210397.png" },
    { name: "Wonderfoam", file: "/Users/kevinmcalear/.gemini/antigravity/brain/c422c0b1-0cca-41a7-b3ab-aeabb9e0e5e5/wonderfoam_ingredient_1772149223839.png" },
    { name: "X Flamed Orange Disc In Mixing Glass", file: "/Users/kevinmcalear/.gemini/antigravity/brain/c422c0b1-0cca-41a7-b3ab-aeabb9e0e5e5/x_flamed_orange_disc_ingredient_1772149237157.png" },
    { name: "Yellow Chartreuse", file: "/Users/kevinmcalear/.gemini/antigravity/brain/c422c0b1-0cca-41a7-b3ab-aeabb9e0e5e5/yellow_chartreuse_ingredient_1772149252127.png" }
];

async function linkImages(item) {
    console.log(`\nMapping images for ${item.name}...`);
    
    // 1. Get Main Entity ID
    let { data: existing, error: existErr } = await supabaseClient.from('ingredients').select('id').eq('name', item.name).maybeSingle();
    
    if (existErr || !existing) {
        console.error(`Could not find record for ${item.name} in DB.`);
        return;
    }
    const recordId = existing.id;
    
    // 2. Upload file securely via Edge Function
    if (item.file && fs.existsSync(item.file)) {
        const fileBuffer = fs.readFileSync(item.file);
        const imageBase64 = fileBuffer.toString('base64');
        // Remove accents and special characters
        const safeName = item.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/ /g, '_');
        const fileName = `ingredients/${safeName}.png`;

        const response = await fetch(SUPABASE_UPLOAD_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseKey}`
            },
            body: JSON.stringify({
                record_id: recordId,
                image_base64: imageBase64,
                file_name: fileName,
                join_table: 'ingredient_images',
                id_field: 'ingredient_id'
            })
        });

        if (response.ok) {
            console.log(`Successfully mapped image for ${item.name}!`);
        } else {
            const rawBody = await response.text();
            console.error(`Failed to map image for ${item.name}. Status: ${response.status} Body:`, rawBody);
        }
    } else {
        console.log(`No local image found at ${item.file}`);
    }
}

async function run() {
    for (const ing of ingredients) {
        await linkImages(ing);
    }
    console.log("Completed!");
}
run();
