import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0")).join("")}`;
}

function colorDistance(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function bucketKey(r: number, g: number, b: number, step = 24): string {
  const br = Math.min(255, Math.round(r / step) * step);
  const bg = Math.min(255, Math.round(g / step) * step);
  const bb = Math.min(255, Math.round(b / step) * step);
  return `${br},${bg},${bb}`;
}

async function extractBrandColors(bytes: Uint8Array): Promise<{ primaryColor: string; secondaryColor: string }> {
  const image = await Image.decode(bytes);
  const size = 64;
  const resized = image.resize(size, size);

  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();

  for (let y = 1; y <= size; y++) {
    for (let x = 1; x <= size; x++) {
      const pixel = resized.getPixelAt(x, y);
      const a = pixel & 0xff;
      const b = (pixel >> 8) & 0xff;
      const g = (pixel >> 16) & 0xff;
      const r = (pixel >> 24) & 0xff;

      if (a < 128) continue;
      if (r > 245 && g > 245 && b > 245) continue;
      if (r < 20 && g < 20 && b < 20) continue;

      const key = bucketKey(r, g, b);
      const existing = buckets.get(key);
      if (existing) {
        existing.count++;
      } else {
        buckets.set(key, { count: 1, r, g, b });
      }
    }
  }

  const sorted = [...buckets.values()].sort((left, right) => right.count - left.count);
  const primaryEntry = sorted[0] ?? { r: 136, g: 136, b: 136, count: 0 };
  const primaryColor = rgbToHex(primaryEntry.r, primaryEntry.g, primaryEntry.b);

  const secondaryEntry =
    sorted.find((entry, index) => index > 0 && colorDistance(entry, primaryEntry) > 60) ??
    sorted[1] ??
    primaryEntry;
  const secondaryColor = rgbToHex(secondaryEntry.r, secondaryEntry.g, secondaryEntry.b);

  return { primaryColor, secondaryColor };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing authorization" }, 401);
    }

    const { bar_id, image_base64, extract_only = false } = await req.json();
    if (!bar_id || !image_base64) {
      return json({ error: "bar_id and image_base64 are required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { data: membership, error: membershipError } = await userClient
      .from("user_bars")
      .select("role_level")
      .eq("bar_id", bar_id)
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (membershipError || !membership || membership.role_level < 35) {
      return json({ error: "You must be a Drink Creator or Admin to update this venue." }, 403);
    }

    const binaryStr = atob(image_base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const { primaryColor, secondaryColor } = await extractBrandColors(bytes);

    if (extract_only) {
      return json({ primaryColor, secondaryColor });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const storageFilePath = `bars/${bar_id}/${Date.now()}.png`;

    const { error: uploadError } = await adminClient.storage.from("drinks").upload(storageFilePath, bytes, {
      contentType: "image/png",
      cacheControl: "3600",
      upsert: true,
    });

    if (uploadError) {
      throw new Error(`Failed to upload logo: ${uploadError.message}`);
    }

    const { data: publicUrlData } = adminClient.storage.from("drinks").getPublicUrl(storageFilePath);

    return json({
      imageUrl: publicUrlData.publicUrl,
      primaryColor,
      secondaryColor,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("upload-bar-logo error:", err);
    return json({ error: message }, 500);
  }
});
