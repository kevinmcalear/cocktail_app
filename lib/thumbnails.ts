/**
 * Smaller copies of a drink picture in the drinks bucket: the 480 px list copy
 * (thumbs/, always a JPEG, made by the image-palette worker) and the 1080 px
 * page copy beside the original ("1@1080.jpg", its own type, so a cut-out
 * stays clear; made by the phone at upload, components/drink/drinkImages.ts,
 * or by the worker for older photos). supabase/functions/_shared/thumbnail.ts
 * must agree with these paths. Null for anything else (a bundled image,
 * another host, a local file). Checked by lib/thumbnails.check.ts.
 */
const PUBLIC_DRINKS = '/storage/v1/object/public/drinks/';
/** The page copy's mark in its file name. */
export const PAGE_COPY = '@1080';

export type CopySize = 'thumb' | 'page';

function copyUrl(url: string, size: CopySize): string | null {
  const at = url.indexOf(PUBLIC_DRINKS);
  if (at < 0 || !/^https?:\/\//.test(url)) return null;
  const [path, query] = url.slice(at + PUBLIC_DRINKS.length).split('?');
  if (!path || path.startsWith('thumbs/') || path.includes(`${PAGE_COPY}.`)) return null;
  const copy = size === 'thumb' ? `thumbs/${path.replace(/\.[^./]+$/, '')}.jpg` : pageCopyPath(path);
  return `${url.slice(0, at + PUBLIC_DRINKS.length)}${copy}${query ? `?${query}` : ''}`;
}

/** "cocktails/abc/1.jpg" -> "cocktails/abc/1@1080.jpg". */
export function pageCopyPath(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot > path.lastIndexOf('/') ? `${path.slice(0, dot)}${PAGE_COPY}${path.slice(dot)}` : `${path}${PAGE_COPY}`;
}

/** The 480 px list copy's URL. */
export const thumbUrl = (url: string) => copyUrl(url, 'thumb');

/** The 1080 px page copy's URL. */
export const pageCopyUrl = (url: string) => copyUrl(url, 'page');

// Originals whose copy failed (not made yet, or a format the worker can't
// read), for this session: a remount (a list scrolling back, a page opened
// again) goes straight to the original instead of asking for the 404 again.
const missing = new Set<string>();

/**
 * The copy to ask for first, or null to show the original: none can exist,
 * or it failed before. The page copy only when the row says the copies were
 * made (images.thumbhash), since older photos have none until the backfill.
 */
export function copyToTry(url: string, size: CopySize, made = true): string | null {
  if (size === 'page' && !made) return null;
  return missing.has(`${size}:${url}`) ? null : copyUrl(url, size);
}

/** Remembers that this original's copy failed, so copyToTry skips it from now on. */
export function markNoCopy(url: string, size: CopySize): void {
  missing.add(`${size}:${url}`);
}

/** The list copy to ask for first (copyToTry). */
export const thumbToTry = (url: string) => copyToTry(url, 'thumb');

/** Remembers that this original's list copy failed. */
export const markNoThumb = (url: string) => markNoCopy(url, 'thumb');
