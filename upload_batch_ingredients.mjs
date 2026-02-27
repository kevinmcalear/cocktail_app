import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import fs from "fs";
dotenv.config();

const SUPABASE_UPLOAD_URL = "https://uzrqriixgxbvhunwrwkn.supabase.co/functions/v1/upload-image";
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseClient = createClient(supabaseUrl, supabaseKey);

// Read the artifact directory
const artifactDir = "/Users/kevinmcalear/.gemini/antigravity/brain/1e52d6fb-eabd-4856-b127-19e565250d1f";
const files = fs.readdirSync(artifactDir);

function findLatest(prefix) {
    const matched = files.filter(f => f.startsWith(prefix) && f.endsWith('.png'));
    if (matched.length === 0) return null;
    return `${artifactDir}/${matched.sort().pop()}`;
}
const map = [
    { name: "Campari", file: findLatest("campari_sketch_v2_") },
    { name: "Candied Ginger", file: findLatest("candied_ginger_sketch_") },
    { name: "Caretakers Gin", file: findLatest("caretakers_gin_sketch_") },
    { name: "Cassis", file: findLatest("cassis_sketch_v2_") },
    { name: "Champagne", file: findLatest("champagne_sketch_") }
];

async function linkImages(item) {
    console.log(`\nMapping images for ${item.name}...`);
    
    let { data: existing, error: existErr } = await supabaseClient.from("ingredients").select('id').eq('name', item.name).maybeSingle();
    
    if (existErr || !existing) {
        console.error(`Could not find record for ${item.name}`);
        return;
    }
    const recordId = existing.id;

    if (item.file && fs.existsSync(item.file)) {
        const fileBuffer = fs.readFileSync(item.file);
        const imageBase64 = fileBuffer.toString('base64');
        const fileName = `ingredients/${item.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;

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
                join_table: "ingredient_images",
                id_field: "ingredient_id"
            })
        });

        const result = await response.json();
        
        if (response.ok) {
            console.log(`Successfully mapped image for ${item.name}! URL: ${result.imageUrl}`);
        } else {
            console.error(`Failed to map image for ${item.name}:`, result.error);
        }
    } else {
        console.log(`No local image found at ${item.file}`);
    }
}

async function run() {
    for (const item of map) {
        await linkImages(item);
    }
}
run();
