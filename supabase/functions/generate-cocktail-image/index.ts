import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { cocktail_id } = await req.json();

    if (!cocktail_id) {
      return new Response(
        JSON.stringify({ error: "cocktail_id is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
        throw new Error("Missing GEMINI_API_KEY in environment variables.");
    }

    // 1. Initialize Supabase Client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 2. Fetch Cocktail Info
    const { data: cocktail, error: fetchError } = await supabaseClient
      .from("cocktails")
      .select(`
        name,
        garnish_1,
        spec,
        method:methods(name),
        glassware:glassware(name),
        ice:ice(name),
        recipes(
          ingredient_amount,
          ingredient_ml,
          ingredient_dash,
          ingredient:ingredients!recipes_ingredient_id_fkey(name)
        )
      `)
      .eq("id", cocktail_id)
      .single();

    if (fetchError || !cocktail) {
      console.error("Fetch DB error:", fetchError);
      return new Response(
        JSON.stringify({ error: "Cocktail not found or database error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // 3. Build Description for Prompt
    const getFirstIfArray = (obj: any) => Array.isArray(obj) ? obj[0] : obj;
    const glassObj = getFirstIfArray(cocktail.glassware);
    const iceObj = getFirstIfArray(cocktail.ice);
    const methodObj = getFirstIfArray(cocktail.method);

    const glasswareName = glassObj ? glassObj.name : "glass";
    const iceName = iceObj ? iceObj.name : "";
    const methodStr = methodObj ? methodObj.name : "prepared";
    const garnishName = cocktail.garnish_1 || "No garnish";
    const specDetails = cocktail.spec ? `Spec: ${cocktail.spec}.` : "";
    
    let ingredientsDetails = "";
    if (cocktail.recipes && (cocktail.recipes as any[]).length > 0) {
      ingredientsDetails = "Contains: " + (cocktail.recipes as any[]).map((r: any) => {
        let amt = [];
        if (r.ingredient_amount) amt.push(`${r.ingredient_amount} oz`);
        if (r.ingredient_ml) amt.push(`${r.ingredient_ml} ml`);
        if (r.ingredient_dash) amt.push(`${r.ingredient_dash} dash`);
        return `${amt.join(" / ")} ${r.ingredient ? r.ingredient.name : ""}`;
      }).join(", ") + ".";
    }

    const description = `${cocktail.name} cocktail inside a ${glasswareName}. ${methodStr} liquid. ${iceName} ice. ${garnishName} garnish on top. ${specDetails} ${ingredientsDetails}`;

    // 4. Construct the Master Generation Prompt (Optimized for Imagen 3)
    const prompt = `A very rough, sketchy, unfinished hand-drawn pencil illustration of a high-end minimalist ${cocktail.name} cocktail. The style is inspired by premium minimalist bars like Caretaker's Cottage: understated elegance. Visible messy sketch lines, overlapping pencil strokes. ${description} PERFECT professional wash line, filled just a finger-width below the rim. The liquid must look very clean, light, and refreshing. The background MUST be a perfectly clean, uniform, flat light paper texture with absolutely no sketchbook edges, no binder rings, and no borders. NO TEXT ANYWHERE. No words. Extremely sophisticated but intentionally rough and unfinished.`;

    console.log(`Generating Gemini Imagen 3 image for ${cocktail.name}...`);

    // 5. Call Gemini API (Imagen 4)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict`;
    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiApiKey
      },
      body: JSON.stringify({
        instances: [
          { prompt: prompt }
        ],
        parameters: {
          sampleCount: 1,
          aspectRatio: "1:1",
          outputOptions: {
            mimeType: "image/png"
          }
        }
      })
    });

    if (!geminiResponse.ok) {
        const errText = await geminiResponse.text();
        throw new Error(`Gemini API failed: ${geminiResponse.status} ${errText}`);
    }

    const geminiData = await geminiResponse.json();
    const image_base64 = geminiData.predictions?.[0]?.bytesBase64Encoded;

    if (!image_base64) {
        throw new Error("No image data returned from Gemini API.");
    }

    console.log(`Successfully generated image for ${cocktail.name}. Uploading to storage...`);

    // 6. Decode base64 to Uint8Array using native JS methods
    const binaryStr = atob(image_base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }

    const timestamp = Date.now();
    const storageFilePath = `cocktails/${cocktail_id}/${timestamp}.png`;

    // 7. Upload to drinks bucket
    const { error: uploadError } = await supabaseClient
        .storage
        .from("drinks")
        .upload(storageFilePath, bytes, {
            contentType: "image/png",
            cacheControl: "3600",
            upsert: false
        });

    if (uploadError) {
        throw new Error(`Failed to upload to storage: ${uploadError.message}`);
    }

    // 8. Get Public URL
    const { data: publicUrlData } = supabaseClient
        .storage
        .from("drinks")
        .getPublicUrl(storageFilePath);

    const publicUrl = publicUrlData.publicUrl;
    console.log(`Uploaded to storage at: ${publicUrl}`);

    // 9. Insert to images table
    const { data: imageRecord, error: dbInsertError } = await supabaseClient
        .from("images")
        .insert([ { url: publicUrl } ])
        .select()
        .single();

    if (dbInsertError || !imageRecord) {
        throw new Error(`Failed to insert into images table: ${JSON.stringify(dbInsertError)}`);
    }

    // 10. Link to cocktail_images table
    const { error: linkError } = await supabaseClient
        .from("cocktail_images")
        .insert([
            {
                cocktail_id: cocktail_id,
                image_id: imageRecord.id
            }
        ]);

    if (linkError) {
        throw new Error(`Failed to link image to cocktail: ${JSON.stringify(linkError)}`);
    }

    console.log(`Successfully linked image ${imageRecord.id} to cocktail ${cocktail_id}`);

    // 11. Success! Return Result
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Triggered Gemini generation and uploaded successfully",
        cocktail: cocktail.name,
        imageUrl: publicUrl
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (err: any) {
    console.error("Edge Function Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
