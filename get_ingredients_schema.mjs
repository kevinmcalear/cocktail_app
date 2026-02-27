import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('Checking ingredients table schema...');
  
  // This is a bit of a trick, we query for 1 row and print the keys
  // or use an edge function if they have one, but we can also just use the REST API
  const { data, error } = await supabase
    .from('ingredients')
    .select('*')
    .limit(1);
    
  if (error) {
    console.error('Error fetching schema:', error.message);
    return;
  }
  
  if (data && data.length > 0) {
    console.log('Columns in ingredients table:');
    console.log(Object.keys(data[0]));
  } else {
    // If table is empty, we can try to insert a dummy row and catch error, 
    // or just fetch by trying to select common columns
    console.log('Table might be empty, unable to infer columns from a row.');
  }
}

checkSchema();
