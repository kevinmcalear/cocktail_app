/**
 * The list-sized copy of a drink picture: a 480 px JPEG beside the original
 * in the drinks bucket, made by the image-palette worker
 * (supabase/functions/_shared/thumbnail.ts thumbPath, which this must agree
 * with). Null for anything else (a bundled image, another host, a local
 * file). Checked by lib/thumbnails.check.ts.
 */
const PUBLIC_DRINKS = '/storage/v1/object/public/drinks/';

export function thumbUrl(url: string): string | null {
  const at = url.indexOf(PUBLIC_DRINKS);
  if (at < 0 || !/^https?:\/\//.test(url)) return null;
  const [path, query] = url.slice(at + PUBLIC_DRINKS.length).split('?');
  if (!path || path.startsWith('thumbs/')) return null;
  return `${url.slice(0, at + PUBLIC_DRINKS.length)}thumbs/${path.replace(/\.[^./]+$/, '')}.jpg${query ? `?${query}` : ''}`;
}
