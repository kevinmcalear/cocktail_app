import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabaseClient = createClient(supabaseUrl, supabaseKey);

const SUPABASE_UPLOAD_URL = `${supabaseUrl}/functions/v1/upload-cocktail-image`;
const artifactsDir = '/Users/kevinmcalear/.gemini/antigravity/brain/1e52d6fb-eabd-4856-b127-19e565250d1f';

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

async function fixMissing() {
  const { data: cocktails, error } = await supabaseClient
    .from('cocktails')
    .select('id, name, cocktail_images(image_id)')
    .order('id', { ascending: true })
    .limit(153);

  if (error) {
    console.error("Error fetching cocktails:", error);
    return;
  }

  const missing = cocktails.filter(c => !c.cocktail_images || c.cocktail_images.length === 0);
  console.log(`Found ${missing.length} cocktails missing images.`);

  const files = fs.readdirSync(artifactsDir);

  for (const c of missing) {
    // Basic normalization: handle curly quotes, make lowercase, replace non-alphanumeric with underscores, etc.
    // e.g., "Cameron’s Kick" -> "cameron_s_kick"
    // "White Negroni\n" -> "white_negroni"
    let prefix = c.name.toLowerCase()
      .trim()
      .replace(/’/g, "'") // straight quote
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_');
    
    if (prefix.endsWith('_')) prefix = prefix.slice(0, -1);
    
    // special cases
    if (prefix === 'boulvardier') prefix = 'boulevardier'; // maybe spelled wrong?
    
    // Find matching file
    let match = files.find(f => f.startsWith(prefix + '_sketch_') && f.endsWith('.png'));
    
    // Check for exact matches for some tricky ones
    if (c.name === "Blackthorn (Irish)") match = files.find(f => f.startsWith("blackthorn_irish_sketch_"));
    if (c.name.trim() === "White Negroni") match = files.find(f => f.startsWith("white_negroni_sketch_"));
    if (c.name === "Cameron’s Kick") match = files.find(f => f.startsWith("camerons_kick_sketch_") || f.startsWith("cameron_s_kick_sketch_"));
    
    if (match) {
      console.log(`Found image for ${c.name.trim()}: ${match}`);
      const filePath = path.join(artifactsDir, match);
      const storageName = `${prefix}-styled`;
      await uploadImage(c.id, filePath, storageName);
    } else {
      console.log(`COULD NOT FIND image for missing cocktail: "${c.name}" (tried prefix ${prefix})`);
    }
  }
}

fixMissing();
