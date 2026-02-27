import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import fs from "fs";
dotenv.config();

// Use Anon key for generic queries, but Storage might need an established session or it happens to be open for upload
// since the user inserted rows directly via SQL editor, it bypassed RLS.
// We will upload to storage, and we can only insert into tables if RLS allows Anon.
// Earlier, `images` insert worked, `storage` upload worked, it was `beers` insert that failed.
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

    // 2. Upload file to storage
    if (item.file && fs.existsSync(item.file)) {
        const fileName = `${table}/${item.file.split('/').pop()}`;
        const fileBuffer = fs.readFileSync(item.file);
        
        let publicUrl = null;
        
        // Let's avoid checking existing storage and just blindly overwrite/upsert it
        const { error: uploadError } = await supabaseClient.storage.from('drinks').upload(fileName, fileBuffer, { upsert: true, contentType: 'image/png' });
        
        if (uploadError) {
            console.error(`Storage Upload Error for ${item.name}:`, uploadError.message);
        } else {
            publicUrl = supabaseClient.storage.from('drinks').getPublicUrl(fileName).data.publicUrl;
        }

        if (publicUrl) {
            // 3. Insert into `images` table
            const { data: imgRecord, error: imgErr } = await supabaseClient.from('images').insert({ url: publicUrl }).select('id').single();
            if (imgErr) { 
                console.error(`[Images Insert Error] ${imgErr.message}`); 
                return; 
            }

            // 4. Delete old join mappings 
            await supabaseClient.from(joinTable).delete().eq(idField, recordId);

            // 5. Insert into join table
            const joinData = {};
            joinData[idField] = recordId;
            joinData['image_id'] = imgRecord.id;
            joinData['sort_order'] = 0;

            const { error: joinErr } = await supabaseClient.from(joinTable).insert(joinData);
            if (joinErr) {
                console.error(`[Join Table Insert Error]`, joinErr.message);
            } else {
                console.log(`Successfully mapped image for ${item.name}! URL: ${publicUrl}`);
            }
        }
    } else {
        console.log(`No local image found at ${item.file}`);
    }
}

async function run() {
    console.log("Starting Linkage...");
    for (const beer of beers) {
        await linkImages(beer, 'beers', 'beer_images', 'beer_id');
    }
    for (const wine of wines) {
        await linkImages(wine, 'wines', 'wine_images', 'wine_id');
    }
    console.log("Completed!");
}
run();
