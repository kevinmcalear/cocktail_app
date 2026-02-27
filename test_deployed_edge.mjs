import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testEdgeFunction() {
    console.log("Fetching a random wine to test...");
    const { data: wines, error: fetchErr } = await supabase
        .from("wines")
        .select("id, name")
        .limit(1);

    if (fetchErr || !wines || wines.length === 0) {
        console.error("Could not fetch wine:", fetchErr);
        return;
    }

    const testItem = wines[0];
    console.log(`Testing with real wine: ${testItem.name} (${testItem.id})`);

    console.log(`Invoking 'generate-wine-image' Edge Function on Prod...`);
    const { data, error } = await supabase.functions.invoke("generate-wine-image", {
        body: {
            wine_id: testItem.id
        }
    });

    if (error) {
        console.error("❌ Edge Function Failed:", error);
    } else {
        console.log("✅ Edge Function Success!");
        console.log("Data returned:", JSON.stringify(data, null, 2));
    }
}

testEdgeFunction();
