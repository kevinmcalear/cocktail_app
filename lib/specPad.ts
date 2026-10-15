/**
 * The spec pad (drink-edit-amount): the amount typed on its own keypad, and
 * the jigger sizes offered for each unit. Pure; checked by lib/specPad.check.ts.
 */

/** One key on the pad: a digit, the point, or ⌫. Returns the amount as typed (a string, so "22." stays). */
export function pressKey(amount: string, key: string): string {
  if (key === '⌫') return amount.slice(0, -1);
  if (key === '.') {
    if (amount.includes('.')) return amount;
    return amount ? `${amount}.` : '0.';
  }
  if (!/^\d$/.test(key)) return amount;
  // Two places after the point is enough for any spec (0.25 oz, 7.5 ml).
  const point = amount.indexOf('.');
  if (point >= 0 && amount.length - point > 2) return amount;
  if (amount === '0') return key;
  if (amount.replace('.', '').length >= 5) return amount;
  return amount + key;
}

const FRACTIONS: Record<string, string> = { '0.25': '¼', '0.5': '½', '0.75': '¾', '1.5': '1½' };

/** The quick amounts under the unit chips: jiggers in ml, quarter ounces, counts for dashes. */
export function quickAmounts(unit: string): { value: string; label: string }[] {
  const list: Record<string, string[]> = {
    ml: ['7.5', '15', '22.5', '30', '45', '60'],
    cl: ['0.75', '1.5', '2.25', '3', '4.5', '6'],
    oz: ['0.25', '0.5', '0.75', '1', '1.5', '2'],
    dash: ['1', '2', '3', '4', '5', '6'],
    drop: ['1', '2', '3', '4', '5', '6'],
    bsp: ['0.5', '1', '2'],
    tsp: ['0.5', '1', '2'],
  };
  return (list[unit] ?? []).map((value) => ({ value, label: unit === 'oz' ? (FRACTIONS[value] ?? value) : value }));
}

/** The pad's amount as the line keeps it: no trailing point, no "0." left half typed. */
export function settleAmount(amount: string): string {
  const trimmed = amount.replace(/\.$/, '');
  return trimmed === '0' || trimmed === '' ? '' : trimmed;
}
