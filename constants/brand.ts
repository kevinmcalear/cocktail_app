import brand from './brand.json';

/**
 * The network product's identity, in one place (constants/brand.json, which
 * app.config.ts also reads): the app name, the legal pages and store copy.
 * productName is a placeholder until the product is named. Bars' own names
 * and logos come from the database, not from here.
 */
export const BRAND: {
  productName: string;
  /** Who operates the service (privacy policy and terms). */
  operator: string;
  supportEmail: string;
  /** When the privacy policy and terms last changed. */
  legalUpdated: string;
} = brand;
