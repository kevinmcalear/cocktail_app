import { consumeAiQuota, refundAiQuota, requireUser } from "../_shared/auth.ts";
import { describeImageAsJson, describeImagesAsJson, generateImage, mockGlassReads } from "../_shared/gemini.ts";
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

// The glass types glass_models knows (lib/sketch/types.ts SKETCH_GLASSES).
const GLASS_TYPES = ["coupe", "nick", "martini", "rocks", "highball", "collins", "fizz", "flute", "wine", "spritz", "snifter", "julep", "tiki", "mug", "ceramic", "beer"];

const MODEL_SCHEMA = {
    type: "object",
    properties: {
        glass: { type: "string", enum: GLASS_TYPES },
        maker_mark: { type: "string", nullable: true, description: "A maker's name or logo etched or printed on the glass, exactly as seen, else null." },
        capacity_ml: { type: "number", nullable: true, description: "Your estimate of the glass's size to the brim, in ml." },
        confidence: { type: "number" },
    },
    required: ["glass", "maker_mark", "capacity_ml", "confidence"],
};

const MODEL_PROMPT = `You are looking at one cocktail glass in a photo. Say what type it is (Nick & Nora is "nick"; old fashioned and shot glasses are "rocks"), copy any maker's mark you can read on it, and estimate its size to the brim in ml. Don't guess a maker you can't read.`;

/** The models nearest the read: the type, the mark if any, closest in size first. Three at most. */
export function nearestModels<T extends { capacity_ml: number | null }>(models: T[], capacityMl: number | null): T[] {
    if (capacityMl == null) return models.slice(0, 3);
    const off = (m: T) => (m.capacity_ml == null ? Infinity : Math.abs(m.capacity_ml - capacityMl));
    return [...models].sort((a, b) => off(a) - off(b)).slice(0, 3);
}

/**
 * Real glasses the photo could be (glass_models): one vision call reads the
 * type, a maker's mark and the size; the database does the matching. No icon
 * is drawn in this mode. Off in the app until Kevin OKs the AI calls (15 Oct 2026).
 */
async function suggestModels(caller: Awaited<ReturnType<typeof requireUser>>, imageBase64: string, mimeType: string) {
    let read: { glass: string; maker_mark: string | null; capacity_ml: number | null; confidence: number };
    if (mockGlassReads()) {
        read = { glass: "coupe", maker_mark: null, capacity_ml: 180, confidence: 0.5 };
    } else {
        await consumeAiQuota(caller, "identify-glassware");
        read = JSON.parse(await describeImagesAsJson([{ base64: imageBase64, mimeType }], MODEL_PROMPT, MODEL_SCHEMA));
    }
    const glass = GLASS_TYPES.includes(read.glass) ? read.glass : null;
    const mark = typeof read.maker_mark === "string" ? read.maker_mark.replace(/[^\p{L}\p{N}&' .-]/gu, " ").trim().slice(0, 60) : "";
    type Found = { id: string; name: string; capacity_ml: number | null; glass: string; variant: string | null; maker: unknown };
    const search = async (q: string): Promise<Found[]> => {
        const { data, error } = await caller.admin.rpc("search_glass_models", { p_query: q, p_glass: glass, p_limit: 100 }).select(
            "id, name, capacity_ml, glass, variant, maker:profiles!glass_models_maker_profile_id_fkey(handle, display_name)",
        );
        if (error) throw error;
        return (data ?? []) as unknown as Found[];
    };
    let data = await search(mark);
    // A mark that matches nothing: fall back to the type alone.
    if (mark && !data.length) data = await search("");
    const capacity = typeof read.capacity_ml === "number" && read.capacity_ml > 0 ? read.capacity_ml : null;
    return { glass, makerMark: mark || null, capacityMl: capacity, confidence: read.confidence ?? 0, models: nearestModels(data, capacity) };
}

serveJson("identify-glassware", async (req) => {
    const caller = await requireUser(req);

    const { image_base64, mime_type = "image/jpeg", suggest_models = false } = await req.json().catch(() => ({}));
    if (typeof image_base64 !== "string" || !image_base64) {
        throw new HttpError(400, "image_base64 is required.");
    }
    if (image_base64.length > MAX_IMAGE_BASE64_LENGTH) {
        throw new HttpError(413, "That photo is too large. Try a smaller one.");
    }
    if (!IMAGE_MIME_TYPES.includes(mime_type)) {
        throw new HttpError(400, "That file type isn't supported.");
    }

    if (suggest_models === true) return await suggestModels(caller, image_base64, mime_type);

    await consumeAiQuota(caller, "identify-glassware");

    const parsed = JSON.parse(await describeImageAsJson(image_base64, mime_type, VISION_PROMPT)) as {
        suggestedName?: string;
        matchedIcon?: string | null;
        confidence?: number;
        reason?: string;
    };

    const suggestedName = (parsed.suggestedName || "Custom Glass").replace(/[\r\n]/g, " ").trim().slice(0, 80) || "Custom Glass";
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0;
    let matchedIcon: string | null = parsed.matchedIcon || null;
    if (matchedIcon && !GLASSWARE_ICON_KEYS.includes(matchedIcon)) matchedIcon = null;
    if (matchedIcon && confidence < MATCH_THRESHOLD) matchedIcon = null;

    let iconUrl: string | null = null;
    if (!matchedIcon) {
        // Vision already took one unit. Drawing a new icon is a second paid call.
        await consumeAiQuota(caller, "identify-glassware");
        try {
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
        } catch (err) {
            await refundAiQuota(caller, "identify-glassware");
            throw err;
        }
    }

    return {
        suggestedName,
        matchedIcon,
        iconUrl,
        confidence,
        reason: parsed.reason || null,
    };
});
