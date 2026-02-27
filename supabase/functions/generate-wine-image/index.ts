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
    const { wine_id } = await req.json();

    if (!wine_id) {
      return new Response(
        JSON.stringify({ error: "wine_id is required" }),
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

    const { data: wine, error: fetchError } = await supabaseClient
      .from("wines")
      .select(`*`)
      .eq("id", wine_id)
      .single();

    if (fetchError || !wine) {
      console.error("Fetch DB error:", fetchError);
      return new Response(
        JSON.stringify({ error: "Wine not found or database error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    let descriptionObj = [];
    if (wine.location) descriptionObj.push(`from ${wine.location}`);
    if (wine.abv) descriptionObj.push(`${wine.abv}% ABV`);
    
    const details = descriptionObj.length > 0 ? descriptionObj.join(", ") : "Fine wine";
    const prompt = `A very rough, sketchy, unfinished hand-drawn pencil illustration of a high-end minimalist wine: ${wine.name}. ${details}. The style is inspired by premium minimalist bars like Caretaker's Cottage: understated elegance. Visible messy sketch lines, overlapping pencil strokes. PERFECT professional pour, served in an elegant appropriate wine glass. The liquid must look very specific to its style/color. The background MUST be a perfectly clean, uniform, flat light paper texture with absolutely no sketchbook edges, no binder rings, and no borders. NO TEXT ANYWHERE. No words. Extremely sophisticated but intentionally rough and unfinished.`;

    console.log(`Generating Gemini Imagen 4 image for wine: ${wine.name}...`);

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict`;
    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiApiKey
      },
      body: JSON.stringify({
        instances: [{ prompt: prompt }],
        parameters: { sampleCount: 1, aspectRatio: "1:1", outputOptions: { mimeType: "image/png" } }
      })
    });

    if (!geminiResponse.ok) {
        throw new Error(`Gemini API failed: ${geminiResponse.status} ${await geminiResponse.text()}`);
    }

    const geminiData = await geminiResponse.json();
    const image_base64 = geminiData.predictions?.[0]?.bytesBase64Encoded;

    if (!image_base64) throw new Error("No image data returned from Gemini API.");

    const binaryStr = atob(image_base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }

    const timestamp = Date.now();
    const storageFilePath = `wines/${wine_id}/${timestamp}.png`;

    const { error: uploadError } = await supabaseClient
        .storage
        .from("drinks")
        .upload(storageFilePath, bytes, { contentType: "image/png", cacheControl: "3600", upsert: false });

    if (uploadError) throw new Error(`Failed to upload to storage: ${uploadError.message}`);

    const { data: publicUrlData } = supabaseClient.storage.from("drinks").getPublicUrl(storageFilePath);
    const publicUrl = publicUrlData.publicUrl;

    const { data: imageRecord, error: dbInsertError } = await supabaseClient
        .from("images")
        .insert([{ url: publicUrl }])
        .select()
        .single();

    if (dbInsertError || !imageRecord) throw new Error(`Failed to insert into images table: ${JSON.stringify(dbInsertError)}`);

    const { error: linkError } = await supabaseClient
        .from("wine_images")
        .insert([{ wine_id: wine_id, image_id: imageRecord.id }]);

    if (linkError) throw new Error(`Failed to link image to wine: ${JSON.stringify(linkError)}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Triggered Gemini generation and uploaded successfully",
        wine: wine.name,
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
