import { consumeAiQuota, refundAiQuota, requireUser } from "../_shared/auth.ts";
import { describeImagesAsJson, mockMenuReads } from "../_shared/gemini.ts";
import { HttpError, serveJson } from "../_shared/http.ts";
import { cleanMenuReading, MENU_READ_PROMPT, MENU_READ_SCHEMA, MOCK_MENU_REPLY } from "../_shared/menuRead.ts";

const FN = "read-menu";
const MAX_PHOTOS = 4;
// About 8 MB of image once decoded, and about 12 MB across all the pages.
const MAX_PHOTO_BASE64_LENGTH = 11_000_000;
const MAX_TOTAL_BASE64_LENGTH = 16_000_000;
const IMAGE_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];

/**
 * Reads photos of a printed drinks menu: its sections, drinks, the
 * ingredients printed under each, and prices. One AI unit per call, however
 * many pages. Mocked on a local stack unless MENU_MODEL=live.
 */
serveJson(FN, async (req) => {
  const mock = mockMenuReads();
  // Lets tests confirm the model is mocked before they send anything.
  if (req.method === "GET") return { model: mock ? "mock" : "live" };

  const caller = await requireUser(req);
  const { photos } = await req.json().catch(() => ({}));
  if (!Array.isArray(photos) || !photos.length) throw new HttpError(400, "Add a photo of the menu.");
  if (photos.length > MAX_PHOTOS) throw new HttpError(400, `Up to ${MAX_PHOTOS} photos at a time.`);
  let total = 0;
  const images = photos.map((photo: { base64?: unknown; mime_type?: unknown }) => {
    const base64 = photo?.base64;
    const mimeType = typeof photo?.mime_type === "string" ? photo.mime_type : "image/jpeg";
    if (typeof base64 !== "string" || !base64) throw new HttpError(400, "One of the photos is empty.");
    if (!IMAGE_MIME_TYPES.includes(mimeType)) throw new HttpError(400, "That file type isn't supported.");
    if (base64.length > MAX_PHOTO_BASE64_LENGTH) throw new HttpError(413, "One of the photos is too large. Try a smaller one.");
    total += base64.length;
    return { base64, mimeType };
  });
  if (total > MAX_TOTAL_BASE64_LENGTH) throw new HttpError(413, "Those photos are too large together. Try fewer pages.");

  await consumeAiQuota(caller, FN);
  let raw: unknown;
  try {
    raw = mock ? MOCK_MENU_REPLY : JSON.parse(await describeImagesAsJson(images, MENU_READ_PROMPT, MENU_READ_SCHEMA));
  } catch (err) {
    await refundAiQuota(caller, FN);
    throw err;
  }
  const reading = cleanMenuReading(raw);
  if (!reading.sections.length) {
    // Nothing to show for it, so it doesn't count against the day.
    await refundAiQuota(caller, FN);
    throw new HttpError(422, "Couldn't find any drinks in that photo. Try a closer, flatter shot of the menu.");
  }
  return reading;
});
