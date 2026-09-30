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
