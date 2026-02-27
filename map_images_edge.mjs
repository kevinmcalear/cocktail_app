import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import fs from "fs";
dotenv.config();

const SUPABASE_UPLOAD_URL = "https://uzrqriixgxbvhunwrwkn.supabase.co/functions/v1/upload-image";
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseClient = createClient(supabaseUrl, supabaseKey);

const beers = [
    { name: "Cottage Lager", file: "assets/images/beers/cottage_lager.png" },
    { name: "Hazy IPA", file: "assets/images/beers/hazy_ipa.png" },
    { name: "Oatmeal Stout", file: "assets/images/beers/oatmeal_stout.png" },
    { name: "Sour Ale", file: "assets/images/beers/sour_ale.png" },
    { name: "Double IPA", file: "assets/images/beers/double_ipa.png" },
    { name: "Pacific Ale", file: "assets/images/beers/pacific_ale.png" },
    { name: "Amber Ale", file: "assets/images/beers/amber_ale.png" }
];

const wines = [
    { name: "House Red", file: "assets/images/wines/house_red.png" },
    { name: "Crisp White", file: "assets/images/wines/crisp_white.png" },
    { name: "Pet Nat", file: "assets/images/wines/pet_nat.png" },
    { name: "Reserve Pinot Noir", file: "assets/images/wines/pinot_noir.png" },
    { name: "Summer Rosé", file: "assets/images/wines/summer_rose.png" },
    { name: "Vintage Shiraz", file: "assets/images/wines/vintage_shiraz.png" },
    { name: "Orange Wine", file: "assets/images/wines/orange_wine.png" }
];

async function linkImages(item, table, joinTable, idField) {
    console.log(`\nMapping images for ${item.name}...`);
    
    // 1. Get Main Entity ID
    let { data: existing, error: existErr } = await supabaseClient.from(table).select('id').eq('name', item.name).maybeSingle();
    
    if (existErr || !existing) {
        console.error(`Could not find record for ${item.name} in DB. Ensure spelling matches exact DB entry.`);
        return;
    }
    const recordId = existing.id;
    console.log(`Found ID: ${recordId}`);

    // 2. Upload file securely via Edge Function
    if (item.file && fs.existsSync(item.file)) {
        const fileBuffer = fs.readFileSync(item.file);
        const imageBase64 = fileBuffer.toString('base64');
        const fileName = `${table}/${item.file.split('/').pop()}`;

        const response = await fetch(SUPABASE_UPLOAD_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseKey}` // Used for standard Cors even though func has service key
            },
            body: JSON.stringify({
                record_id: recordId,
                image_base64: imageBase64,
                file_name: fileName,
                join_table: joinTable,
                id_field: idField
            })
        });

        let result;
        try {
            const rawBody = await response.text();
            result = JSON.parse(rawBody);
            if (response.ok) {
                console.log(`Successfully mapped image for ${item.name}! URL: ${result.imageUrl}`);
            } else {
                console.error(`Failed to map image for ${item.name}. Status: ${response.status} Body:`, rawBody);
            }
        } catch(e) {
            console.error("Failed to parse response:", e)
        }
    } else {
        console.log(`No local image found at ${item.file}`);
    }
}

async function run() {
    console.log("Starting Linkage via Edge Function...");
    for (const beer of beers) {
        await linkImages(beer, 'beers', 'beer_images', 'beer_id');
    }
    for (const wine of wines) {
        await linkImages(wine, 'wines', 'wine_images', 'wine_id');
    }
    console.log("Completed!");
}
run();
