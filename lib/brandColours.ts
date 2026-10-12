/**
 * The brand screen's colour words: a plain name for a colour ("Rust",
 * "Cream", "Ink"), and the contrast check under Ground tint, worked out with
 * the same rules the app uses to draw the brand (lib/color).
 */
import { backbar, GROUND_TINTS } from '@/constants/tokens';
import { accentFill, contrast, parseHex, readableAccent } from '@/lib/color';

/** The two inks a venue picks between for text on accent buttons. */
export const ACCENT_INK = { cream: backbar.dark.ink, ink: backbar.dark.ground } as const;
export type AccentInk = keyof typeof ACCENT_INK;

const AA = 4.5;
const BIG_TYPE = 3;

function hsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = parseHex(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

const HUES: [number, string][] = [
  [12, 'Red'],
  [28, 'Rust'],
  [45, 'Amber'],
  [68, 'Gold'],
  [165, 'Green'],
  [200, 'Teal'],
  [255, 'Blue'],
  [295, 'Violet'],
  [340, 'Plum'],
  [360, 'Red'],
];

/** A plain name for a colour, for the swatch cards. Close enough, never a brand name. */
export function colourName(hex: string): string {
  const { h, s, l } = hsl(hex);
  if (l >= 0.85) return h < 70 || h > 330 ? 'Cream' : 'Mist';
  if (l <= 0.16) return 'Ink';
  if (s < 0.12) return l > 0.5 ? 'Stone' : 'Charcoal';
  return HUES.find(([upTo]) => h < upTo)?.[1] ?? 'Red';
}

function ratio(n: number): string {
  return `${(Math.floor(n * 10) / 10).toFixed(1)} : 1`;
}

export interface ContrastLine {
  ratio: string;
  label: string;
  verdict: string;
  passes: boolean;
}

/**
 * The four lines of the contrast check: the accent on the dark ground, button
 * text on the accent, the accent on the light ground, and the other ink on the
 * accent. Each says Passes or what the app does instead.
 */
export function contrastLines(accent: string, groundTint: string | null, pick: AccentInk | null): ContrastLine[] {
  const name = colourName(accent);
  const darkGround = groundTint ?? backbar.dark.ground;
  const groundName = GROUND_TINTS.find((t) => t.hex.toUpperCase() === darkGround.toUpperCase())?.label ?? 'the ground';
  const out: ContrastLine[] = [];

  const onDark = contrast(accent, darkGround);
  const darkShade = readableAccent(accent, darkGround);
  out.push({
    ratio: ratio(onDark),
    label: `${name} on ${groundName}, dark mode`,
    verdict: onDark >= AA ? 'Passes' : `Too dark for text, so dark mode uses ${darkShade} (${ratio(contrast(darkShade, darkGround))})`,
    passes: onDark >= AA,
  });

  const button = pick
    ? accentFill(accent, ACCENT_INK.ink, ACCENT_INK.cream, pick === 'ink' ? 'dark' : 'light')
    : accentFill(accent, ACCENT_INK.ink, ACCENT_INK.cream);
  const ink: AccentInk = button.text === ACCENT_INK.ink ? 'ink' : 'cream';
  const inkName = ink === 'ink' ? 'Ink' : 'Cream';
  const deepened = button.fill.toUpperCase() !== accent.toUpperCase();
  out.push({
    ratio: ratio(contrast(button.fill, button.text)),
    label: `${inkName} on ${name}, buttons`,
    verdict: deepened ? `Passes on a deeper ${button.fill}` : 'Passes',
    passes: true,
  });

  const light = contrast(accent, backbar.light.ground);
  const lightShade = readableAccent(accent, backbar.light.ground);
  out.push({
    ratio: ratio(light),
    label: `${name} on light ground`,
    verdict: light >= AA ? 'Passes' : `Too light for text, so light mode uses ${lightShade} (${ratio(contrast(lightShade, backbar.light.ground))})`,
    passes: light >= AA,
  });

  const other: AccentInk = ink === 'ink' ? 'cream' : 'ink';
  const otherName = other === 'ink' ? 'Ink' : 'Cream';
  const otherRatio = contrast(accent, ACCENT_INK[other]);
  out.push({
    ratio: ratio(otherRatio),
    label: `${otherName} on ${name}`,
    verdict:
      otherRatio >= AA ? 'Passes too' : otherRatio >= BIG_TYPE ? `Big type only, so buttons use ${inkName}` : `Too low, so buttons use ${inkName}`,
    passes: otherRatio >= AA,
  });
  return out;
}
