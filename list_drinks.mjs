import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function list() {
    const { data: bData, error: bErr } = await supabase.from('beers').select('*');
    if (bErr) console.error("Beers error:", bErr.message);
    else console.log("Beers:", bData);
    
    const { data: wData, error: wErr } = await supabase.from('wines').select('*');
    if (wErr) console.error("Wines error:", wErr.message);
    else console.log("Wines:", wData);
}
list();
