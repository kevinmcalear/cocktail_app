import { consumeAiQuota, refundAiQuota, requireUser } from "../_shared/auth.ts";
import { BOTTLE_READ_PROMPT, BOTTLE_READ_SCHEMA, cleanBottlesReading, MOCK_BOTTLE_REPLY } from "../_shared/bottleRead.ts";
import { describeImagesAsJson, mockBottleReads } from "../_shared/gemini.ts";
import { HttpError, serveJson } from "../_shared/http.ts";

const FN = "read-bottle";
// About 8 MB of image once decoded.
const MAX_PHOTO_BASE64_LENGTH = 11_000_000;
const IMAGE_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];

/**
 * Reads the labels on the bottles in one photo: brand, product name, kind and
 * ABV. The app matches them to the catalog. One AI unit per call. Mocked on a
 * local stack unless BOTTLE_MODEL=live.
 */
serveJson(FN, async (req) => {
  const mock = mockBottleReads();
  // Lets tests confirm the model is mocked before they send anything.
  if (req.method === "GET") return { model: mock ? "mock" : "live" };

  const caller = await requireUser(req);
  const { photo } = await req.json().catch(() => ({}));
  const base64 = photo?.base64;
  const mimeType = typeof photo?.mime_type === "string" ? photo.mime_type : "image/jpeg";
  if (typeof base64 !== "string" || !base64) throw new HttpError(400, "Add a photo of the bottle.");
  if (!IMAGE_MIME_TYPES.includes(mimeType)) throw new HttpError(400, "That file type isn't supported.");
  if (base64.length > MAX_PHOTO_BASE64_LENGTH) throw new HttpError(413, "That photo is too large. Try a smaller one.");

  await consumeAiQuota(caller, FN);
  let raw: unknown;
  try {
    raw = mock ? MOCK_BOTTLE_REPLY : JSON.parse(await describeImagesAsJson([{ base64, mimeType }], BOTTLE_READ_PROMPT, BOTTLE_READ_SCHEMA));
  } catch (err) {
    await refundAiQuota(caller, FN);
    throw err;
  }
  const reading = cleanBottlesReading(raw);
  if (!reading.bottles.length) {
    // Nothing to show for it, so it doesn't count against the day.
    await refundAiQuota(caller, FN);
    throw new HttpError(422, "Couldn't read a label in that photo. Try closer, with the front label facing you.");
  }
  return reading;
});
