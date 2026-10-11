/**
 * Fetches the main screens' code at the lowest priority, once the first
 * screen's data is in (app/_layout.tsx), so a first tap to them doesn't wait
 * on the network. Code only a few routes use ships with those routes rather
 * than on every page (the common-chunk patch), so this keeps those taps fast.
 * The list comes from the build (scripts/write-route-chunks.mjs); without it
 * (a dev server) nothing happens, nor when the browser asks to save data.
 */
export async function prefetchRoutes() {
  const connection = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (connection?.saveData || /2g/.test(connection?.effectiveType ?? '')) return;
  const res = await fetch('/route-chunks.json').catch(() => null);
  if (!res?.ok) return;
  const routes = (await res.json()) as Record<string, string[]>;
  const have = new Set([...document.scripts].map((s) => new URL(s.src, location.href).pathname));
  for (const src of new Set(Object.values(routes).flat())) {
    if (have.has(src)) continue;
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'script';
    link.href = src;
    document.head.appendChild(link);
  }
}
