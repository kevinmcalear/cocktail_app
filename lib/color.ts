/**
 * Colour maths for venue brands: WCAG contrast, and an accent that stays
 * readable whatever colour a venue picks.
 */

type RGB = [number, number, number];

export function parseHex(hex: string): RGB {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const n = parseInt(full, 16);
  if (Number.isNaN(n) || full.length !== 6) throw new Error(`Not a hex colour: ${hex}`);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex([r, g, b]: RGB): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function mix(hex: string, toward: string, amount: number): string {
  const a = parseHex(hex);
  const b = parseHex(toward);
  return toHex(a.map((v, i) => v + (b[i] - v) * amount) as RGB);
}

const AA = 4.5;

/**
 * The venue's accent adjusted so it can be read as text on `ground`: pushed
 * toward white on dark grounds and toward black on light ones, in 5% steps,
 * until it reaches 4.5:1. An accent that already passes comes back unchanged.
 */
export function readableAccent(accent: string, ground: string): string {
  const towardWhite = luminance(ground) < 0.5;
  let out = toHex(parseHex(accent));
  for (let step = 1; step <= 20 && contrast(out, ground) < AA; step++) {
    out = mix(accent, towardWhite ? '#FFFFFF' : '#000000', step * 0.05);
  }
  return out;
}

/**
 * A button fill in the venue's accent, and the text to put on it. Uses
 * whichever ink reads better; if neither reaches 4.5:1 (mid-tone accents),
 * the fill is deepened until the light ink does.
 */
export function accentFill(accent: string, darkInk: string, lightInk: string): { fill: string; text: string } {
  const best = (fill: string) => (contrast(fill, darkInk) >= contrast(fill, lightInk) ? darkInk : lightInk);
  let fill = toHex(parseHex(accent));
  if (contrast(fill, best(fill)) >= AA) return { fill, text: best(fill) };
  for (let step = 1; step <= 20 && contrast(fill, lightInk) < AA; step++) {
    fill = mix(accent, '#000000', step * 0.05);
  }
  return { fill, text: lightInk };
}

/** The colour as rgba at the given opacity, for tints behind text in that colour. */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** True for #RGB or #RRGGBB, the formats venues store their colours in. */
export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}
