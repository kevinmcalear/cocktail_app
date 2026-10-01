import { createClient } from "npm:@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

import { drinksBucketUrl } from "../_shared/drinksUrl.ts";
import { corsHeaders } from "../_shared/http.ts";

/**
 * Public (no sign-in): what a phone needs to install a venue's staff web app
 * (/v/<slug>) with the venue's own name and icon.
 *
 *   GET /venue-app/manifest?slug=<slug>&origin=<site origin>   web app manifest
 *   GET /venue-app/icon?slug=<slug>&size=<180|192|512>          square PNG icon
 *
 * Only a venue's name, logo and colours are exposed, and only by exact slug.
 */

const ICON_SIZES = new Set([180, 192, 512]);
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FALLBACK_SITE = Deno.env.get("SITE_URL") ?? "https://babyvom.it";

interface Branding {
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  /** Set on the brand screen; the name and logo stand in when they're empty. */
  short_name: string | null;
  icon_url: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const route = url.pathname.split("/").pop();
  const slug = url.searchParams.get("slug") ?? "";
  if (!SLUG_RE.test(slug)) return notFound();

  try {
    const branding = await getBranding(slug);
    if (!branding) return notFound();
    if (route === "manifest") return manifest(branding, url);
    if (route === "icon") return await icon(branding, Number(url.searchParams.get("size")));
    return notFound();
  } catch (err) {
    console.error("venue-app error:", err);
    return new Response("Something went wrong", { status: 500, headers: corsHeaders });
  }
});

async function getBranding(slug: string): Promise<Branding | null> {
  const client = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    auth: { persistSession: false },
  });
  const { data, error } = await client.rpc("get_venue_branding", { p_slug: slug }).maybeSingle();
  if (error) throw error;
  return (data as Branding | null) ?? null;
}

/** The site the staff link lives on: the page passes its own origin. */
function siteOrigin(url: URL): string {
  const origin = url.searchParams.get("origin");
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (parsed.protocol === "https:" || parsed.hostname === "localhost") return parsed.origin;
    } catch {
      // fall through
    }
  }
  return FALLBACK_SITE;
}

function manifest(branding: Branding, url: URL): Response {
  const site = siteOrigin(url);
  const iconSrc = (size: number) => `icon?slug=${branding.slug}&size=${size}`; // relative to this manifest
  const body = {
    id: `/v/${branding.slug}`,
    name: branding.name,
    short_name: branding.short_name ?? branding.name,
    start_url: `${site}/v/${branding.slug}`,
    scope: `${site}/`,
    display: "standalone",
    background_color: "#161618",
    theme_color: branding.primary_color ?? "#161618",
    icons: [
      { src: iconSrc(192), sizes: "192x192", type: "image/png" },
      { src: iconSrc(512), sizes: "512x512", type: "image/png" },
      { src: iconSrc(512), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=300",
    },
  });
}

/**
 * The venue's home-screen icon (or its logo) centred on a square, padded with its own
 * background (its corner pixel) or white if the logo is transparent.
 * Opaque, as iOS fills transparency with black. Venues without a logo get
 * the network icon.
 */
async function icon(branding: Branding, size: number): Promise<Response> {
  if (!ICON_SIZES.has(size)) return new Response("Unsupported size", { status: 400, headers: corsHeaders });
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const source = drinksBucketUrl(branding.icon_url ?? branding.logo_url ?? "", supabaseUrl);
  if (!source) {
    return Response.redirect(`${FALLBACK_SITE}/icon-${size === 180 ? 192 : size}.png`, 302);
  }

  const bytes = await fetchLogo(source, supabaseUrl);
  const logo = await Image.decode(bytes);

  const corner = logo.getPixelAt(1, 1);
  const background = (corner & 0xff) < 250 ? 0xffffffff : corner;

  // Keep the logo inside the central 80%, which maskable icons never crop.
  const box = Math.round(size * 0.8);
  const scale = Math.min(box / logo.width, box / logo.height);
  const fitted = logo.resize(Math.max(1, Math.round(logo.width * scale)), Math.max(1, Math.round(logo.height * scale)));

  const canvas = new Image(size, size).fill(background);
  canvas.composite(fitted, Math.round((size - fitted.width) / 2), Math.round((size - fitted.height) / 2));
  // Copy into an ArrayBuffer-backed array, which Response accepts as a body.
  const png = new Uint8Array(await canvas.encode());

  return new Response(png, {
    headers: { ...corsHeaders, "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
  });
}

const MAX_LOGO_BYTES = 8_000_000;

/** Follows at most one redirect, and only to another drinks-bucket URL. */
async function fetchLogo(source: string, supabaseUrl: string): Promise<Uint8Array> {
  let current = source;
  for (let hop = 0; hop < 2; hop++) {
    const res = await fetch(current, { redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) throw new Error("Logo redirect had no location");
      const absolute = new URL(next, current).href;
      if (!drinksBucketUrl(absolute, supabaseUrl)) throw new Error("Logo redirect left the drinks bucket");
      current = absolute;
      continue;
    }
    if (!res.ok) throw new Error(`Logo fetch failed: ${res.status}`);
    return await readCapped(res);
  }
  throw new Error("Too many logo redirects");
}

async function readCapped(res: Response): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("Logo response had no body");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_LOGO_BYTES) {
      await reader.cancel();
      throw new Error("Logo is too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function notFound(): Response {
  return new Response("Not found", { status: 404, headers: corsHeaders });
}
