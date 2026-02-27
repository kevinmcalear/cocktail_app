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
    const { beer_id, image_base64, file_name } = await req.json();

    if (!beer_id || !image_base64 || !file_name) {
      return new Response(
        JSON.stringify({ error: "beer_id, image_base64, and file_name are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const binaryStr = atob(image_base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }

    const timestamp = Date.now();
    const storageFilePath = `beers/${beer_id}/${timestamp}.png`;

    const { error: uploadError } = await supabaseClient
      .storage
      .from("drinks")
      .upload(storageFilePath, bytes, {
        contentType: "image/png",
        cacheControl: "3600",
        upsert: false
      });

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
      .from("beer_images")
      .insert([{ beer_id: beer_id, image_id: imageRecord.id }]);

    if (linkError) throw new Error(`Failed to link image to beer: ${JSON.stringify(linkError)}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Image uploaded and linked successfully",
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
