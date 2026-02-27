import dotenv from 'dotenv';
dotenv.config();

async function testEdge() {
    console.log("Testing Edge Function locally...");
    
    // We will simulate the request hitting the local edge function URL. 
    // Usually it runs on port 54321
    const testPayload = {
        ingredient_id: "00000000-0000-0000-0000-000000000000", // dummy ID for test
        ingredient_name: "Test Ingredient",
        sub_ingredients: ["Magic", "Sparkles"]
    };

    try {
        const response = await fetch("http://127.0.0.1:54321/functions/v1/generate-ingredient-image", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // Pass the anon key to hit the function
                "Authorization": `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify(testPayload)
        });

        const data = await response.json();
        console.log("Response Status:", response.status);
        console.log("Response Body:", data);
    } catch (e) {
        console.error("Fetch failed:", e.message);
    }
}

testEdge();
