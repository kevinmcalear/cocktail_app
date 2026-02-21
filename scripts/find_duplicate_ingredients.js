const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function findDuplicates() {
  console.log("Fetching all ingredients...");
  const { data: ingredients, error } = await supabase
    .from('ingredients')
    .select('*')
    .order('name');
    
  if (error) {
    console.error("Error fetching ingredients:", error);
    return;
  }
  
  console.log(`Found ${ingredients.length} total ingredients.`);
  
  // Group by normalized name
  const grouped = {};
  for (const item of ingredients) {
    // Normalize: lowercase and trim whitespace
    const normalized = item.name.toLowerCase().trim();
    if (!grouped[normalized]) {
      grouped[normalized] = [];
    }
    grouped[normalized].push(item);
  }
  
  let duplicateCount = 0;
  console.log("\n--- DUPLICATE INGREDIENTS ---");
  for (const [normalizedName, items] of Object.entries(grouped)) {
    if (items.length > 1) {
      duplicateCount++;
      console.log(`\nDuplicate: "${normalizedName}" (${items.length} entries)`);
      items.forEach(item => {
        console.log(`  - ID: ${item.id}, Exact Name: "${item.name}", is_batch: ${item.is_batch}`);
      });
    }
  }
  
  if (duplicateCount === 0) {
    console.log("No duplicates found!");
  } else {
    console.log(`\nFound ${duplicateCount} sets of duplicate ingredients.`);
  }
}

findDuplicates();
