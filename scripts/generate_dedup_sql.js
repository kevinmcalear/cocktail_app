const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function generateDedupSql() {
  console.log("Fetching all ingredients...");
  const { data: ingredients, error } = await supabase
    .from('ingredients')
    .select('*')
    .order('name');
    
  if (error) {
    console.error("Error fetching ingredients:", error);
    return;
  }
  
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
  
  let sqlLines = [];
  sqlLines.push('-- DEDUPLICATE INGREDIENTS SCRIPT');
  sqlLines.push('-- Generated based on current duplicate names (case-insensitive fallback)');
  sqlLines.push('BEGIN;');
  sqlLines.push('');
  
  let duplicateCount = 0;
  for (const [normalizedName, items] of Object.entries(grouped)) {
    if (items.length > 1) {
      duplicateCount++;
      
      // We pick the canonical version. Let's try to pick one that starts with uppercase if possible
      // Otherwise just the first one.
      let canonical = items.find(i => /^[A-Z]/.test(i.name)) || items[0];
      const duplicates = items.filter(i => i.id !== canonical.id);
      
      sqlLines.push(`-- Merging duplicates for: "${normalizedName}" into canonical ID: ${canonical.id} ("${canonical.name}")`);
      
      for (const dup of duplicates) {
        sqlLines.push(`-- Removing duplicate: "${dup.name}" (${dup.id})`);
        // Update foreign keys in recipes
        sqlLines.push(`  UPDATE recipes SET ingredient_id = '${canonical.id}' WHERE ingredient_id = '${dup.id}';`);
        sqlLines.push(`  UPDATE recipes SET parent_ingredient_id = '${canonical.id}' WHERE parent_ingredient_id = '${dup.id}';`);
        // Update foreign keys in cocktails
        sqlLines.push(`  UPDATE cocktails SET garnish_id = '${canonical.id}' WHERE garnish_id = '${dup.id}';`);
        // Delete the duplicate ingredient
        sqlLines.push(`  DELETE FROM ingredients WHERE id = '${dup.id}';`);
      }
      sqlLines.push('');
    }
  }
  
  sqlLines.push('COMMIT;');
  sqlLines.push('');
  
  const sqlString = sqlLines.join('\n');
  const outputFile = './deduplicate_ingredients.sql';
  fs.writeFileSync(outputFile, sqlString);
  
  console.log(`\nGenerated SQL script to merge ${duplicateCount} sets of duplicate ingredients.`);
  console.log(`Saved output to: ${outputFile}`);
}

generateDedupSql();
