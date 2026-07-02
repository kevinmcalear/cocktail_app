import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GLASSWARE_ICON_KEYS = [
    "Coupette", "Coupe", "Martini", "Rocks", "Highball", "Fizz", "Ceramic",
    "Tall Spirit Mixer", "Spritz", "Flute", "Nick & Nora", "Small Rocks",
    "Rocks & Crushed ice", "Mug", "Snifter", "Tiki", "Beer", "Wine",
];

const MATCH_THRESHOLD = 0.72;

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { image_base64, mime_type = "image/jpeg" } = await req.json();
        if (!image_base64) {
            return json({ error: "image_base64 is required" }, 400);
        }

        const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
        if (!geminiApiKey) throw new Error("Missing GEMINI_API_KEY");

        const iconList = GLASSWARE_ICON_KEYS.map((k) => `"${k}"`).join(", ");
        const visionPrompt = `You are identifying cocktail glassware from a photo.

Known built-in icon shapes (pick ONE only if the glass clearly matches that silhouette):
${iconList}

Respond with JSON only:
{
  "suggestedName": "best guess at the glassware name (e.g. Coupe, Nick & Nora, Irish Coffee Mug)",
  "matchedIcon": "exact key from the list above, or null if no good shape match",
  "confidence": 0.0 to 1.0,
  "reason": "one short sentence"
}

Rules:
- matchedIcon must be null unless confidence >= ${MATCH_THRESHOLD} AND the shape clearly matches.
- suggestedName should be the common bar-industry name, title case.
- Prefer matching an existing icon over inventing a new shape name.`;

        const visionRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { inline_data: { mime_type, data: image_base64 } },
                            { text: visionPrompt },
                        ],
                    }],
                    generationConfig: { responseMimeType: "application/json" },
                }),
            }
        );

        if (!visionRes.ok) {
            throw new Error(`Vision API failed: ${visionRes.status} ${await visionRes.text()}`);
        }

        const visionData = await visionRes.json();
        const rawText = visionData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) throw new Error("No vision response");

        const parsed = JSON.parse(rawText) as {
            suggestedName?: string;
            matchedIcon?: string | null;
            confidence?: number;
            reason?: string;
        };

        const suggestedName = (parsed.suggestedName || "Custom Glass").trim();
        const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0;
        let matchedIcon: string | null = parsed.matchedIcon || null;
        if (matchedIcon && !GLASSWARE_ICON_KEYS.includes(matchedIcon)) matchedIcon = null;
        if (matchedIcon && confidence < MATCH_THRESHOLD) matchedIcon = null;

        let iconUrl: string | null = null;
        if (!matchedIcon) {
            iconUrl = await generateCustomIcon(geminiApiKey, suggestedName);
        }

        return json({
            suggestedName,
            matchedIcon,
            iconUrl,
            confidence,
            reason: parsed.reason || null,
        });
    } catch (err: any) {
        console.error("identify-glassware error:", err);
        return json({ error: err.message || "Internal server error" }, 500);
    }
});

async function generateCustomIcon(geminiApiKey: string, glassName: string): Promise<string> {
    const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const prompt = `Minimal single-stroke line art icon of an empty ${glassName} cocktail glass, side profile silhouette. Clean white strokes on solid black background. Simple 24px app icon style matching other bar glass icons. No liquid, no garnish, no text, no shading.`;

    const imagenRes = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict",
        {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": geminiApiKey },
            body: JSON.stringify({
                instances: [{ prompt }],
                parameters: { sampleCount: 1, aspectRatio: "1:1", outputOptions: { mimeType: "image/png" } },
            }),
        }
    );

    if (!imagenRes.ok) {
        throw new Error(`Icon generation failed: ${imagenRes.status} ${await imagenRes.text()}`);
    }

    const imagenData = await imagenRes.json();
    const imageBase64 = imagenData.predictions?.[0]?.bytesBase64Encoded;
    if (!imageBase64) throw new Error("No icon image returned");

    const binaryStr = atob(imageBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    const path = `glassware-icons/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
    const { error: uploadError } = await supabase.storage.from("drinks").upload(path, bytes, {
        contentType: "image/png",
        cacheControl: "86400",
        upsert: false,
    });
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data } = supabase.storage.from("drinks").getPublicUrl(path);
    return data.publicUrl;
}

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
    });
}
