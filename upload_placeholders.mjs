import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const SUPABASE_UPLOAD_URL = "https://uzrqriixgxbvhunwrwkn.supabase.co/functions/v1/upload-cocktail-image";
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseClient = createClient(supabaseUrl, supabaseKey);

async function uploadImage(cocktailId, filePath, fileName) {
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return;
    }
    const base64Image = fs.readFileSync(filePath, { encoding: 'base64' });
    console.log(`Uploading ${fileName}...`);
    
    const response = await fetch(SUPABASE_UPLOAD_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
            cocktail_id: cocktailId,
            image_base64: base64Image,
            file_name: fileName
        })
    });
    
    const result = await response.json();
    if (!response.ok) {
        console.error(`Failed to upload ${fileName}:`, result);
    } else {
        console.log(`Successfully uploaded ${fileName}:`, result.imageUrl);
    }
}

async function main() {
    const { data: cocktails } = await supabaseClient.from('cocktails').select('id, name').in('name', [
        'Affinity', 'Chet Baker', 'Moscow Mule', 'Young American', 'Amaretto Sour'
    ]);
    
    const getId = (name) => cocktails.find(c => c.name === name)?.id;
    console.log("Starting upload pipeline for batch 12...");

    const id1 = getId('Affinity');
    if (id1) await uploadImage(id1, '/Users/kevinmcalear/.gemini/antigravity/brain/1e52d6fb-eabd-4856-b127-19e565250d1f/affinity_sketch_1772047828244.png', 'affinity-styled');

    const id2 = getId('Chet Baker');
    if (id2) await uploadImage(id2, '/Users/kevinmcalear/.gemini/antigravity/brain/1e52d6fb-eabd-4856-b127-19e565250d1f/chet_baker_sketch_1772047886422.png', 'chet-baker-styled');
    
    const id3 = getId('Moscow Mule');
    if (id3) await uploadImage(id3, '/Users/kevinmcalear/.gemini/antigravity/brain/1e52d6fb-eabd-4856-b127-19e565250d1f/moscow_mule_sketch_1772047938425.png', 'moscow-mule-styled');
    
    const id4 = getId('Young American');
    if (id4) await uploadImage(id4, '/Users/kevinmcalear/.gemini/antigravity/brain/1e52d6fb-eabd-4856-b127-19e565250d1f/young_american_sketch_1772048155670.png', 'young-american-styled');
    
    const id5 = getId('Amaretto Sour');
    if (id5) await uploadImage(id5, '/Users/kevinmcalear/.gemini/antigravity/brain/1e52d6fb-eabd-4856-b127-19e565250d1f/amaretto_sour_sketch_1772048197301.png', 'amaretto-sour-styled');
    
    console.log("Done.");
}

main();
