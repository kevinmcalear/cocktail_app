// Fetching a link someone pasted into Bring in, without letting it reach
// anything private. Plain TypeScript: fetch and DNS are passed in, so
// scripts/linkRead.check.ts runs it under Node with fakes.
//
// ponytail: each hop's addresses are checked before fetching, but fetch
// resolves the name again itself, so a domain that flips to a private address
// in between (DNS rebinding) isn't caught. The ceiling is an internal service
// that answers plain HTTP on 80/443 to the edge runtime; the upgrade is
// fetching through an egress proxy that refuses private addresses.

export const MAX_LINK_BYTES = 3_000_000;
const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 10_000;
const MAX_TEXT = 20_000;
const FILE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];

export class LinkError extends Error {}

/** A link worth fetching: http(s), the default port, no login, a public-looking host name (never a bare IP). */
export function checkLinkUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new LinkError("That doesn't look like a link.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new LinkError("Only web links can be read.");
  if (url.username || url.password || url.port) throw new LinkError("That link can't be read.");
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const ipLike = /^[\d.]+$/.test(host) || host.startsWith("[") || /^0x/i.test(host) || host.includes(":");
  const internal = !host.includes(".") || /(^|\.)(localhost|local|internal|lan|home\.arpa|intranet|corp)$/.test(host);
  if (ipLike || internal) throw new LinkError("That link can't be read.");
  return url;
}

function v4Parts(ip: string): number[] | null {
  const parts = ip.split(".").map(Number);
  return parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) ? parts : null;
}

function v4Public([a, b, c]: number[]): boolean {
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
  if (a === 169 && b === 254) return false; // link-local, cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

/** True only for an address on the public internet. Anything unreadable counts as private. */
export function isPublicAddress(ip: string): boolean {
  const v4 = v4Parts(ip);
  if (v4) return v4Public(v4);
  const lower = ip.toLowerCase();
  if (!lower.includes(":")) return false;
  // An IPv4 address carried in IPv6 (::ffff:10.0.0.1, 64:ff9b::a00:1) is judged as that address.
  const tail = lower.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (tail) return v4Parts(tail[1]) ? v4Public(v4Parts(tail[1])!) : false;
  if (lower === "::" || lower === "::1") return false;
  const first = parseInt(lower.split(":")[0] || "0", 16);
  if ((first & 0xfe00) === 0xfc00) return false; // unique local fc00::/7
  if ((first & 0xffc0) === 0xfe80) return false; // link-local fe80::/10
  if ((first & 0xff00) === 0xff00) return false; // multicast
  if (lower.startsWith("::ffff:") || lower.startsWith("64:ff9b:") || lower.startsWith("2001:db8:") || lower.startsWith("2002:") || lower.startsWith("2001:0:")) return false;
  return (first & 0xe000) === 0x2000; // global unicast 2000::/3 only
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", frac12: "½", frac14: "¼", frac34: "¾", deg: "°" };

function decode(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z0-9]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

function meta(html: string, name: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return content ? decode(content).trim() : null;
}

type Json = Record<string, unknown>;

/** schema.org Recipe objects anywhere in the page's JSON-LD, as plain lines. */
function jsonLdRecipes(html: string): string[] {
  const out: string[] = [];
  const blocks = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    const obj = node as Json;
    const type = obj["@type"];
    const isRecipe = type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"));
    if (isRecipe) {
      const lines = [String(obj.name ?? "Recipe")];
      const author = obj.author as Json | Json[] | string | undefined;
      const by = typeof author === "string" ? author : Array.isArray(author) ? author[0]?.name : author?.name;
      if (by) lines.push(`By ${by}`);
      for (const ing of Array.isArray(obj.recipeIngredient) ? obj.recipeIngredient : []) lines.push(`- ${ing}`);
      const steps = Array.isArray(obj.recipeInstructions) ? obj.recipeInstructions : obj.recipeInstructions ? [obj.recipeInstructions] : [];
      for (const s of steps) lines.push(typeof s === "string" ? s : String((s as Json)?.text ?? ""));
      out.push(lines.filter(Boolean).map((l) => decode(String(l)).trim()).join("\n"));
    }
    for (const value of Object.values(obj)) if (value && typeof value === "object") visit(value);
  };
  for (const block of blocks) {
    try {
      visit(JSON.parse(block.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "")));
    } catch {
      // A broken JSON-LD block is just skipped.
    }
  }
  return out;
}

/** What a web page says, for the reader: its recipe data first, then its title, description and text. */
export function pageText(html: string): string {
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
  const description = meta(html, "og:description") ?? meta(html, "description");
  const body = decode(
    html
      .replace(/<(script|style|noscript|svg|template|head)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\r]+/g, " ")
    .replace(/ *\n[\s]*/g, "\n")
    .trim();
  const parts = [...jsonLdRecipes(html), title, meta(html, "og:title"), description, body].filter((p): p is string => !!p);
  return [...new Set(parts)].join("\n\n").slice(0, MAX_TEXT);
}

export type LinkContent = { text: string } | { file: { bytes: Uint8Array; mimeType: string } };

export interface LinkDeps {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  /** Every address the name resolves to; empty when it doesn't. */
  resolve: (host: string) => Promise<string[]>;
}

async function readCapped(res: Response): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_LINK_BYTES) throw new LinkError("That page is too big to read.");
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_LINK_BYTES) {
      await reader.cancel();
      throw new LinkError("That page is too big to read.");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  return out;
}

/** Fetches the link, checking every hop, and returns its text (web page) or the file it is (photo, PDF). */
export async function fetchLink(raw: string, deps: LinkDeps): Promise<LinkContent> {
  let url = checkLinkUrl(raw);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const addresses = await deps.resolve(url.hostname);
    if (!addresses.length) throw new LinkError("Couldn't find that site.");
    if (!addresses.every(isPublicAddress)) throw new LinkError("That link can't be read.");
    let res: Response;
    try {
      res = await deps.fetch(url.toString(), {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; CocktailBringIn/1.0)", Accept: "text/html,application/xhtml+xml,text/plain,image/*,application/pdf;q=0.9,*/*;q=0.1" },
      });
    } catch {
      throw new LinkError("That link didn't open. Try copying the recipe's text instead.");
    }
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      await res.body?.cancel();
      if (!next) throw new LinkError("That link didn't open.");
      url = checkLinkUrl(new URL(next, url).toString());
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw new LinkError(`That link didn't open (${res.status}). If it needs a login, copy the recipe's text instead.`);
    }
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (FILE_TYPES.includes(type)) return { file: { bytes: await readCapped(res), mimeType: type } };
    if (type === "text/html" || type === "application/xhtml+xml" || type === "text/plain" || !type) {
      const raw = new TextDecoder().decode(await readCapped(res));
      const text = type === "text/plain" ? raw.slice(0, MAX_TEXT) : pageText(raw);
      if (!text.trim()) throw new LinkError("That page had nothing to read. Try copying the recipe's text instead.");
      return { text };
    }
    await res.body?.cancel();
    throw new LinkError("That kind of link can't be read. Try a web page, a photo or a PDF.");
  }
  throw new LinkError("That link redirects too many times.");
}
