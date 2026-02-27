import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function checkSchema() {
    console.log("Checking Beers...");
    const { data: bData, error: bErr } = await supabase.from('beers').select('*').limit(1);
    console.log("Beers columns:", bData && bData.length > 0 ? Object.keys(bData[0]) : (bErr ? bErr.message : "Empty table, but exists."));
    if (bData && bData.length === 0 && !bErr) {
        // Table exists but is empty, try inserting a dummy to get schema error or success
         const { error: insErr } = await supabase.from('beers').insert({}).select('*');
         console.log("Empty Insert Error reveals columns?", insErr?.message);
    }
    
    console.log("\nChecking Wines...");
    const { data: wData, error: wErr } = await supabase.from('wines').select('*').limit(1);
    console.log("Wines columns:", wData && wData.length > 0 ? Object.keys(wData[0]) : (wErr ? wErr.message : "Empty table, but exists."));
    if (wData && wData.length === 0 && !wErr) {
         const { error: insErr } = await supabase.from('wines').insert({}).select('*');
         console.log("Empty Insert Error reveals columns?", insErr?.message);
    }
}
checkSchema();
