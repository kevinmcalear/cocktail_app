import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testBucket() {
    const { data, error } = await supabase.storage.getBucket('ingredients');
    console.log("Bucket data:", data);
    console.log("Bucket error:", error);
}

testBucket();
