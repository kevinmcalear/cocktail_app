// Where emails sent by functions link back to. Pure (no Deno or Node APIs),
// so the app's unit checks can run it.

/** The production site, unless the SITE_URL secret names another. */
export const DEFAULT_SITE = "https://babyvom.it";

/**
 * The origin an email links back to: the app's own site, or a localhost
 * origin when the function runs on a local stack. Anything else (a preview
 * deploy, or whatever a caller sent) gets the site, so a link in an email
 * never leads anywhere but the app.
 */
export function siteOrigin(value: unknown, site: string, local: boolean): string {
  const home = new URL(site).origin;
  try {
    const url = new URL(String(value));
    if (url.origin === home) return home;
    const localhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (local && localhost && (url.protocol === "http:" || url.protocol === "https:")) return url.origin;
  } catch {
    // fall through
  }
  return home;
}
