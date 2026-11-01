import brand from './brand.json';

/**
 * The network product's identity, in one place (constants/brand.json, which
 * app.config.ts, the web build and the link previews also read): the app's
 * name, domain and link scheme, whether search engines may index the public
 * pages, the legal pages and store copy. A new name or domain is a one-line
 * change here (plus a store build for the name under the icon); the bundle id
 * never changes. Bars' own names and logos come from the database.
 */
export const BRAND: {
  productName: string;
  /** The web app and public pages, without https:// (placeholder until the real domain). */
  domain: string;
  /** The app's link scheme (store builds; dev and preview builds add a suffix). */
  scheme: string;
  /**
   * Off until the real domain (Kevin, 31 Oct): public pages tell search
   * engines to stay out. On: indexing, canonical addresses and robots.txt's sitemap.
   */
  searchIndexing: boolean;
  /** Who operates the service (privacy policy and terms). */
  operator: string;
  supportEmail: string;
  /** When the privacy policy and terms last changed. */
  legalUpdated: string;
} = brand;

/** https://<domain>, unless EXPO_PUBLIC_SITE_URL points the app elsewhere (a preview deploy). */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || `https://${BRAND.domain}`).replace(/\/$/, '');
