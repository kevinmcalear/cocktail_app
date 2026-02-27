import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Prompt Template based on the approved aesthetic
function buildPrompt(ingredientName: string, subIngredients: string[]) {
  const isCompound = subIngredients && subIngredients.length > 0;
  
  let contextStr = "";
  if (isCompound) {
    const primarySubs = subIngredients.slice(0, 3).join(", ");
    contextStr = `Incorporate very subtle, faint visual hints of ${primarySubs} nearby as sub-ingredients`;
  } else {
    contextStr = `Incorporate a very delicate, elegant bar tool (like a small silver measuring spoon, picking tongs, or a single pristine ice cube) nearby as a subtle accent`;
  }

  return `A very rough, sketchy, unfinished hand-drawn pencil illustration of ${ingredientName}. The style is inspired by premium minimalist bars like Caretaker's Cottage: understated elegance. Visible messy sketch lines everywhere, overlapping pencil strokes, very rough and unfinished sketch-wise. ${contextStr}, and ONLY very subtle, muted, toned-down watercolor washes (use colors appropriate for ${ingredientName}) for a slight hint of color—not fully colored in. The background MUST be a perfectly clean, uniform, flat light paper texture with absolutely no sketchbook edges, no binder rings, and no borders. NO TEXT ANYWHERE. No words. Extremely sophisticated, elegant, but intentionally rough and sketchy.`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { ingredient_id, ingredient_name, sub_ingredients } = await req.json();

    if (!ingredient_id || !ingredient_name) {
      return new Response(
        JSON.stringify({ error: "ingredient_id and ingredient_name are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
        throw new Error("Missing GEMINI_API_KEY in environment variables.");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const prompt = buildPrompt(ingredient_name, sub_ingredients || []);
    console.log(`Generating Gemini Imagen 3 image for ${ingredient_name}...`);

    // Call Gemini API (Imagen 4)
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

    console.log(`Successfully generated image for ${ingredient_name}. Uploading to storage...`);

    // Decode base64 to Uint8Array using native JS methods
    const binaryStr = atob(image_base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }

    const timestamp = Date.now();
    const storageFilePath = `ingredients/${ingredient_id}/${timestamp}.png`;

    // Upload to drinks bucket
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

    // Get Public URL
    const { data: publicUrlData } = supabaseClient
        .storage
        .from("drinks")
        .getPublicUrl(storageFilePath);

    const publicUrl = publicUrlData.publicUrl;
    console.log(`Uploaded to storage at: ${publicUrl}`);

    // Insert to images table
    const { data: imageRecord, error: dbInsertError } = await supabaseClient
        .from("images")
        .insert([ { url: publicUrl } ])
        .select()
        .single();

    if (dbInsertError || !imageRecord) {
        throw new Error(`Failed to insert into images table: ${JSON.stringify(dbInsertError)}`);
    }

    // Link to ingredient_images table
    const { error: linkError } = await supabaseClient
        .from("ingredient_images")
        .insert([
            {
                ingredient_id: ingredient_id,
                image_id: imageRecord.id
            }
        ]);

    if (linkError) {
        throw new Error(`Failed to link image to ingredient: ${JSON.stringify(linkError)}`);
    }

    console.log(`Successfully linked image ${imageRecord.id} to ingredient ${ingredient_id}`);

    return new Response(
        JSON.stringify({ 
            success: true, 
            message: "Image generated, uploaded, and linked successfully",
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
