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
        'Ti Punch'
    ]);
    
    const getId = (name) => cocktails.find(c => c.name === name)?.id;
    console.log("Starting upload pipeline for the final missing cocktail...");

    const id1 = getId('Ti Punch');
    if (id1) await uploadImage(id1, '/Users/kevinmcalear/.gemini/antigravity/brain/1e52d6fb-eabd-4856-b127-19e565250d1f/ti_punch_sketch_1772079492542.png', 'ti-punch-styled');
    
    console.log("Done.");
}

main();
