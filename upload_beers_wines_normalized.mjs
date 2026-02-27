import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import fs from "fs";
dotenv.config();

// Use the local upload API which runs the Service Role Key on the backend
const SUPABASE_UPLOAD_URL = "https://uzrqriixgxbvhunwrwkn.supabase.co/functions/v1/upload-cocktail-image";
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

async function insertItem(item, table, joinTable, idField) {
    console.log(`\nProcessing ${item.name} into ${table}...`);
    
    // 1. Get or Create Main Entity
    let recordId = null;
    let { data: existing, error: existErr } = await supabaseClient.from(table).select('id').eq('name', item.name).maybeSingle();
    
    if (existErr) {
        console.error(`Error finding ${item.name}:`, existErr.message);
        return;
    }

    if (existing) {
        recordId = existing.id;
        console.log(`Found existing ${item.name} with ID: ${recordId}`);
    } else {
        // Assume minimal schema: only 'name'
        const { data: inserted, error: insErr } = await supabaseClient.from(table).insert({
            name: item.name
        }).select('id').single();
        if (insErr) { console.error(`Insert error for ${item.name}:`, insErr.message); return; }
        recordId = inserted.id;
        console.log(`Inserted ${item.name} with ID: ${recordId}`);
    }

    // 2. We can upload manually and insert into images and join tables since we have Anon access 
    // Wait, last time the 'storage' upload failed on Anon. 
    // Let's use the Edge function for storage + images insert?
    // Edge function specifically requires `cocktail_id` and links to `cocktail_images`.
    // We cannot use it for beers/wines.
    // Instead we upload to storage via Anon (our `test_upload` worked earlier, it failed above due to "violates RLS policy" on the DB INSERT, *not* the storage upload!).
    // "Failed to upload Cottage Lager image: new row violates row-level security policy"
    // The error was specifically: code: 'PGRST204', message: "Could not find the 'price' column of 'beers' in the schema cache"
    // Wait, the 'violates row level security' was the Storage Upload? Let's trace.
    // Let me try the exact bare-bones upload.

    if (item.file && fs.existsSync(item.file)) {
        const fileName = `${table}/${item.file.split('/').pop()}`;
        const fileBuffer = fs.readFileSync(item.file);
        
        const { error: uploadError } = await supabaseClient.storage.from('drinks').upload(fileName, fileBuffer, { upsert: true, contentType: 'image/png' });
        
        let publicUrl = null;
        if (uploadError) {
            console.error(`Storage Upload Error for ${item.name}:`, uploadError.message);
            // If it violates RLS, maybe we must read from disk later. Let's see if public works
        } else {
            publicUrl = supabaseClient.storage.from('drinks').getPublicUrl(fileName).data.publicUrl;
        }

        if (publicUrl) {
            // Insert into images
            const { data: imgRecord, error: imgErr } = await supabaseClient.from('images').insert({ url: publicUrl }).select('id').single();
            if (imgErr) { 
                console.error(`[Images Insert Error] ${imgErr.message}`); 
                return; 
            }

            // Insert into join table
            const joinData = {};
            joinData[idField] = recordId;
            joinData['image_id'] = imgRecord.id;
            joinData['sort_order'] = 0;

            const { error: joinErr } = await supabaseClient.from(joinTable).insert(joinData);
            if (joinErr) {
                console.error(`[Join Table Insert Error]`, joinErr.message);
            } else {
                console.log(`Successfully mapped image for ${item.name} via join table!`);
            }
        }
    } else {
        console.log(`No local image found at ${item.file}`);
    }
}

async function run() {
    console.log("Starting Minimal Normalized Migration...");
    for (const beer of beers) {
        await insertItem(beer, 'beers', 'beer_images', 'beer_id');
    }
    for (const wine of wines) {
        await insertItem(wine, 'wines', 'wine_images', 'wine_id');
    }
    console.log("Done.");
}
run();
