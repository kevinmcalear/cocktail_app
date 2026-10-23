/**
 * Money in a bar's one currency, kept in minor units (pence, cents) as the
 * database does. Pure; hooks read and write the integers, screens format.
 */

/** Currencies a bar is likely to pick, first in the list. */
export const COMMON_CURRENCIES = ['GBP', 'EUR', 'USD', 'AUD', 'SGD', 'JPY', 'HKD', 'CAD'] as const;

/** Currencies with no minor unit: yen and won are whole numbers. */
const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'ISK', 'HUF']);

export function isCurrencyCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value);
}

/** Minor units per major unit: 100 for most, 1 for yen. */
export function minorPerMajor(currency: string): number {
  return ZERO_DECIMAL.has(currency) ? 1 : 100;
}

/** "£12.00", "€1.90", "¥1,200". Falls back to the code when Intl doesn't know it. */
export function formatMoney(minor: number | null | undefined, currency: string | null | undefined): string | null {
  if (minor == null || !isCurrencyCode(currency)) return null;
  const major = minor / minorPerMajor(currency);
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(major);
  } catch {
    return `${major.toFixed(minorPerMajor(currency) === 1 ? 0 : 2)} ${currency}`;
  }
}

/** "12", "12.5", "£12.50", "1,200" typed by a person, as minor units; null when it isn't a price. */
export function parseMoney(text: string, currency: string): number | null {
  const cleaned = text.replace(/[^0-9.,-]/g, '').replace(/,/g, '');
  if (!cleaned || cleaned === '.' || cleaned === '-') return null;
  const major = Number(cleaned);
  if (!Number.isFinite(major) || major < 0) return null;
  return Math.round(major * minorPerMajor(currency));
}

/** Minor units as a plain number for a text field: 1250 → "12.50", 1200 (JPY) → "1200". */
export function moneyFieldValue(minor: number | null | undefined, currency: string): string {
  if (minor == null) return '';
  const per = minorPerMajor(currency);
  return per === 1 ? String(minor) : (minor / per).toFixed(2);
}

/**
 * A drink's price as the bar typed it ("19", "$19.50", "14 / 60"), as minor
 * units: the first number in it, so a glass / bottle price reads as the
 * glass. Null for "MP", blanks and words. Same rule as the database's
 * private.price_minor_of (20261103100000).
 */
export function priceMinor(price: string | null | undefined, currency: string | null | undefined): number | null {
  const first = price?.match(/\d[\d,]*(?:\.\d+)?/)?.[0];
  if (!first) return null;
  const major = Number(first.replace(/,/g, ''));
  return Number.isFinite(major) ? Math.round(major * minorPerMajor(currency ?? '')) : null;
}

/** Minor units as a price to save on a drink: 2300 → "23", 2350 → "23.50", 1200 yen → "1200". */
export function priceText(minor: number, currency: string): string {
  const per = minorPerMajor(currency);
  return minor % per === 0 ? String(minor / per) : (minor / per).toFixed(2);
}
