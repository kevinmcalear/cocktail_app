import { consumeAiQuota, requireUser } from "../_shared/auth.ts";
import { describeImageAsJson, generateImage } from "../_shared/gemini.ts";
import { HttpError, serveJson } from "../_shared/http.ts";

const GLASSWARE_ICON_KEYS = [
    "Coupette", "Coupe", "Martini", "Rocks", "Highball", "Fizz", "Ceramic",
    "Tall Spirit Mixer", "Spritz", "Flute", "Nick & Nora", "Small Rocks",
    "Rocks & Crushed ice", "Mug", "Snifter", "Tiki", "Beer", "Wine",
];

const MATCH_THRESHOLD = 0.72;

// About 8 MB of image once decoded.
const MAX_IMAGE_BASE64_LENGTH = 11_000_000;
const IMAGE_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];

const VISION_PROMPT = `You are identifying cocktail glassware from a photo.

Known built-in icon shapes (pick ONE only if the glass clearly matches that silhouette):
${GLASSWARE_ICON_KEYS.map((k) => `"${k}"`).join(", ")}

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

serveJson("identify-glassware", async (req) => {
    const caller = await requireUser(req);

    const { image_base64, mime_type = "image/jpeg" } = await req.json().catch(() => ({}));
    if (typeof image_base64 !== "string" || !image_base64) {
        throw new HttpError(400, "image_base64 is required.");
    }
    if (image_base64.length > MAX_IMAGE_BASE64_LENGTH) {
        throw new HttpError(413, "That photo is too large. Try a smaller one.");
    }
    if (!IMAGE_MIME_TYPES.includes(mime_type)) {
        throw new HttpError(400, "That file type isn't supported.");
    }

    await consumeAiQuota(caller, "identify-glassware");

    const parsed = JSON.parse(await describeImageAsJson(image_base64, mime_type, VISION_PROMPT)) as {
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
        const icon = await generateImage(
            `Minimal single-stroke line art icon of an empty ${suggestedName} cocktail glass, side profile silhouette. ` +
                "Clean white strokes on solid black background. Simple 24px app icon style matching other bar glass icons. " +
                "No liquid, no garnish, no text, no shading.",
        );
        const path = `glassware-icons/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${icon.ext}`;
        const bucket = caller.admin.storage.from("drinks");
        const { error } = await bucket.upload(path, icon.bytes, { contentType: icon.mimeType, cacheControl: "86400", upsert: false });
        if (error) throw error;
        iconUrl = bucket.getPublicUrl(path).data.publicUrl;
    }

    return {
        suggestedName,
        matchedIcon,
        iconUrl,
        confidence,
        reason: parsed.reason || null,
    };
});
