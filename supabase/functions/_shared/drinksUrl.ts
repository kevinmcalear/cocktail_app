/**
 * A public object URL in this project's `drinks` bucket.
 * Venue icons are fetched by a public edge function, so anything else
 * (cloud metadata, another host, a redirect off-bucket) is rejected.
 */
export function drinksBucketUrl(raw: string, supabaseUrl: string): string | null {
  let url: URL;
  let project: URL;
  try {
    url = new URL(raw);
    project = new URL(supabaseUrl);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;

  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const sameHost = url.hostname === project.hostname;
  const protocolOk =
    (url.protocol === "https:" && sameHost) ||
    (url.protocol === "http:" && (local || (sameHost && project.protocol === "http:")));
  if (!protocolOk) return null;

  let path: string;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (path.includes("..") || path.includes("\\")) return null;
  if (!path.startsWith("/storage/v1/object/public/drinks/")) return null;
  return url.href;
}
