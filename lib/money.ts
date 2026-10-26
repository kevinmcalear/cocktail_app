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

const EURO = 'AD AT BE BG CY DE EE ES FI FR GR HR IE IT LT LU LV MC ME MT NL PT SI SK SM VA XK'.split(' ');
// ponytail: the countries bars here are likely in; any other shows money with no symbol until the bar picks its currency (Pricing).
const COUNTRY_CURRENCY: Record<string, string> = {
  ...Object.fromEntries(EURO.map((c) => [c, 'EUR'])),
  GB: 'GBP', IM: 'GBP', JE: 'GBP', GG: 'GBP', US: 'USD', PR: 'USD', CA: 'CAD', MX: 'MXN', AU: 'AUD', NZ: 'NZD',
  SG: 'SGD', HK: 'HKD', JP: 'JPY', KR: 'KRW', CN: 'CNY', TW: 'TWD', TH: 'THB', MY: 'MYR', ID: 'IDR', PH: 'PHP', VN: 'VND', IN: 'INR',
  CH: 'CHF', LI: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', IS: 'ISK', PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON', TR: 'TRY',
  AE: 'AED', IL: 'ILS', ZA: 'ZAR', BR: 'BRL', AR: 'ARS', CL: 'CLP', CO: 'COP', PE: 'PEN',
};

/**
 * The currency money shows in: the bar's own (Pricing), else its country's,
 * else the device's (at home only). Null when none is known: no symbol, never
 * a guessed one (a bar in Sydney was shown pounds, Eddie 26 Oct).
 */
export function currencyFor({ set, country, device }: { set?: string | null; country?: string | null; device?: string | null }): string | null {
  if (isCurrencyCode(set)) return set;
  const fromCountry = country ? COUNTRY_CURRENCY[country.toUpperCase()] : undefined;
  if (fromCountry) return fromCountry;
  return isCurrencyCode(device) ? device : null;
}

// ponytail: names for the usual ones (Hermes has no Intl.DisplayNames); any other shows as its code.
const CURRENCY_NAMES: Record<string, string> = {
  GBP: 'British pound', EUR: 'Euro', USD: 'US dollar', AUD: 'Australian dollar', SGD: 'Singapore dollar', JPY: 'Japanese yen',
  HKD: 'Hong Kong dollar', CAD: 'Canadian dollar', NZD: 'New Zealand dollar', CHF: 'Swiss franc', MXN: 'Mexican peso',
};

/** "Australian dollar, AUD"; a code with no name here is just the code. */
export function currencyLabel(code: string): string {
  const name = CURRENCY_NAMES[code];
  return name ? `${name}, ${code}` : code;
}

/** The usual currencies to pick from, the country's own first (setup's Currency row). */
export function currencyChoices(first: string | null): string[] {
  return first && !COMMON_CURRENCIES.some((c) => c === first) ? [first, ...COMMON_CURRENCIES] : [...(first ? [first] : []), ...COMMON_CURRENCIES.filter((c) => c !== first)];
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

/** As formatMoney, but with no currency known, the number alone ("12.00"). */
export function formatAmount(minor: number, currency: string | null): string {
  return formatMoney(minor, currency) ?? (minor / minorPerMajor(currency ?? '')).toFixed(2);
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
 * glass. Null for "MP", blanks and words.
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
