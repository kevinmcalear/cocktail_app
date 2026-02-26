import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMissing() {
  const { data: cocktails, error } = await supabase
    .from('cocktails')
    .select('id, name, cocktail_images(image_id)')
    .order('id', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    console.error("Error fetching cocktails:", error);
    return;
  }

  const missing = cocktails.filter(c => !c.cocktail_images || c.cocktail_images.length === 0);
  const present = cocktails.filter(c => c.cocktail_images && c.cocktail_images.length > 0);
  
  console.log(`\nTotal cocktails checked: ${cocktails.length}`);
  console.log(`Total cocktails WITH images attached: ${present.length}`);
  console.log(`Total cocktails MISSING images: ${missing.length}`);

  if (missing.length > 0) {
    console.log(`\nMissing List:`);
    missing.forEach(c => console.log(`- ${c.name}`));
  }
}

checkMissing();
