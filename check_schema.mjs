import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

// Use the Service Role Key for writing bypassing RLS if possible. If not, use Anon.
// The Deno Edge Function had SUPABASE_SERVICE_ROLE_KEY
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
// We'll use Anon key to read schema
const supabase = createClient(supabaseUrl, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function checkSchema() {
    const { data: bData, error: bErr } = await supabase.from('beers').select('*').limit(1);
    console.log("Beers columns:", bData && bData.length > 0 ? Object.keys(bData[0]) : (bData ? "Empty but exists" : bErr));
    
    const { data: wData, error: wErr } = await supabase.from('wines').select('*').limit(1);
    console.log("Wines columns:", wData && wData.length > 0 ? Object.keys(wData[0]) : (wData ? "Empty but exists" : wErr));
}
checkSchema();
