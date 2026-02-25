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

    // 4. Construct the Master Generation Prompt (Optimized for Nano-Banana / Gemini)
    const prompt = `A very rough, sketchy, unfinished hand-drawn pencil illustration of a high-end minimalist ${cocktail.name} cocktail. The style is inspired by premium minimalist bars like Caretaker's Cottage: understated elegance. Visible messy sketch lines, overlapping pencil strokes. ${description} PERFECT professional wash line, filled just a finger-width below the rim. The liquid must look very clean, light, and refreshing. The background MUST be a perfectly clean, uniform, flat light paper texture with absolutely no sketchbook edges, no binder rings, and no borders. NO TEXT ANYWHERE. No words. Extremely sophisticated but intentionally rough and unfinished.`;

    console.log("Sending payload to Nano-Banana webhook with prompt:", prompt);

    const nanoBananaWebhookUrl = Deno.env.get("NANO_BANANA_WEBHOOK_URL");
    
    if (!nanoBananaWebhookUrl) {
        throw new Error("Missing NANO_BANANA_WEBHOOK_URL in environment variables.");
    }

    // 5. Call Nano-Banana Webhook
    const webhookResponse = await fetch(nanoBananaWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        cocktail_id: cocktail_id,
        cocktail_name: cocktail.name,
        prompt: prompt,
        timestamp: new Date().toISOString()
      })
    });

    if (!webhookResponse.ok) {
        const errText = await webhookResponse.text();
        throw new Error(`Nano-Banana webhook failed: ${webhookResponse.status} ${errText}`);
    }

    // 6. Success! Return Result
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Triggered Nano-Banana generation successfully",
        cocktail: cocktail.name
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
