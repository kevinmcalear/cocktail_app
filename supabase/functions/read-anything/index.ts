import { anythingReadPrompt, ANYTHING_READ_SCHEMA, cleanAnythingReading, mockAnythingReply, READ_KINDS, type ReadKind } from "../_shared/anythingRead.ts";
import { consumeAiQuota, refundAiQuota, requireUser } from "../_shared/auth.ts";
import { describeImagesAsJson, mockAnythingReads } from "../_shared/gemini.ts";
import { HttpError, serveJson } from "../_shared/http.ts";
import { fetchLink, LinkError, type LinkContent } from "../_shared/linkRead.ts";

const FN = "read-anything";
const MAX_FILES = 4;
// About 8 MB of file once decoded, and about 12 MB across all of them.
const MAX_FILE_BASE64_LENGTH = 11_000_000;
const MAX_TOTAL_BASE64_LENGTH = 16_000_000;
const MAX_TEXT_LENGTH = 20_000;
const FILE_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];

/**
 * Bring in's reader: photos, a PDF, pasted text or a link to a menu, recipes
 * or bottles. Works out which it is and reads that part, so the app can check it
 * line by line. `hint` is the screen the person started from. One AI unit per
 * call. Mocked on a local stack unless READ_MODEL=live.
 */
serveJson(FN, async (req) => {
  const mock = mockAnythingReads();
  // Lets tests confirm the model is mocked before they send anything.
  if (req.method === "GET") return { model: mock ? "mock" : "live" };

  const caller = await requireUser(req);
  const body = await req.json().catch(() => ({}));
  const files: unknown[] = Array.isArray(body?.files) ? body.files : [];
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const hint: ReadKind | null = READ_KINDS.includes(body?.hint) ? body.hint : null;
  const link = typeof body?.url === "string" ? body.url.trim() : "";

  if (!files.length && !text && !link) throw new HttpError(400, "Add a photo, a file, some text or a link to read.");
  if (link && (files.length || text)) throw new HttpError(400, "Read a link on its own.");
  if (link.length > 2_000) throw new HttpError(400, "That link is too long.");
  if (files.length > MAX_FILES) throw new HttpError(400, `Up to ${MAX_FILES} files at a time.`);
  if (text.length > MAX_TEXT_LENGTH) throw new HttpError(413, "That's a lot of text. Try one section at a time.");
  let total = 0;
  const images = files.map((file) => {
    const f = (file && typeof file === "object" ? file : {}) as { base64?: unknown; mime_type?: unknown };
    const mimeType = typeof f.mime_type === "string" ? f.mime_type : "image/jpeg";
    if (typeof f.base64 !== "string" || !f.base64) throw new HttpError(400, "One of the files is empty.");
    if (!FILE_MIME_TYPES.includes(mimeType)) throw new HttpError(400, "That file type isn't supported. Try a photo or a PDF.");
    if (f.base64.length > MAX_FILE_BASE64_LENGTH) throw new HttpError(413, "One of the files is too large. Try a smaller one.");
    total += f.base64.length;
    return { base64: f.base64, mimeType };
  });
  if (total > MAX_TOTAL_BASE64_LENGTH) throw new HttpError(413, "Those files are too large together. Try fewer.");

  await consumeAiQuota(caller, FN);
  // A link is fetched after the unit is taken (so it can't be used as a free
  // fetcher) and refunded when the link doesn't open.
  let page: string | null = text || null;
  if (link) {
    let content: LinkContent;
    try {
      content = await fetchLink(link, { fetch, resolve });
    } catch (err) {
      await refundAiQuota(caller, FN);
      if (err instanceof LinkError) throw new HttpError(422, err.message);
      throw err;
    }
    if ("text" in content) page = `From ${link}:\n\n${content.text}`;
    else images.push({ base64: toBase64(content.file.bytes), mimeType: content.file.mimeType });
  }
  let raw: unknown;
  try {
    raw = mock ? mockAnythingReply(hint) : JSON.parse(await describeImagesAsJson(images, anythingReadPrompt(hint, page), ANYTHING_READ_SCHEMA));
  } catch (err) {
    await refundAiQuota(caller, FN);
    throw err;
  }
  const reading = cleanAnythingReading(raw);
  if (!reading) {
    // Nothing to show for it, so it doesn't count against the day.
    await refundAiQuota(caller, FN);
    throw new HttpError(422, "Couldn't find a menu, a recipe or a bottle in that. Try a closer, flatter shot.");
  }
  return reading;
});

/** Every address a name resolves to. Deno's resolver, else DNS over HTTPS where the runtime has none. */
async function resolve(host: string): Promise<string[]> {
  if (typeof Deno.resolveDns === "function") {
    const [a, aaaa] = await Promise.all([
      Deno.resolveDns(host, "A").catch(() => [] as string[]),
      Deno.resolveDns(host, "AAAA").catch(() => [] as string[]),
    ]);
    return [...a, ...aaaa];
  }
  const ask = async (type: "A" | "AAAA") => {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, {
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(5_000),
    });
    const data = await res.json().catch(() => ({}));
    return ((data.Answer ?? []) as { type: number; data: string }[]).filter((r) => r.type === (type === "A" ? 1 : 28)).map((r) => r.data);
  };
  const [a, aaaa] = await Promise.all([ask("A").catch(() => []), ask("AAAA").catch(() => [])]);
  return [...a, ...aaaa];
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
