/**
 * Make mode's small readings, pure so makeLogic.check.ts can hold them: the
 * kit to get out, the weigh-it hint, a step's hint line, the "What I have"
 * stepper's step, the label's day and its code drawn as one SVG path.
 */
import type { ScaledLine } from '@/lib/scale';

export interface KitItem {
  name: string;
  /** An equipment page in the technique library (lib/techniques/equipment.ts id). */
  equipment?: string;
}

// ponytail: kit read from the step words, since a prep card has no kit list.
// Upgrade path: a kit column on item_prep, filled in the prep editor.
const KIT_WORDS: [RegExp, KitItem][] = [
  [/\b(pan|saucepan|pot|heat|simmer|boil|warm)\b/i, { name: 'Small pan' }],
  [/\b(stir|stirring|dissolve|dissolved)\b/i, { name: 'Spatula' }],
  [/\b(whisk|whisking)\b/i, { name: 'Whisk' }],
  [/\b(blend|blender|blitz)\b/i, { name: 'Blender', equipment: 'blender' }],
  [/\b(strain|sieve|filter)\b/i, { name: 'Fine strainer' }],
  [/\b(jar|container|tub)\b/i, { name: 'Jar' }],
  [/\b(bottle|bottled|funnel)\b/i, { name: 'Funnel' }],
];

/**
 * What to get out besides the ingredients, in bench order: the scale when a
 * line is weighed, the tools the steps name, what it goes into, and a label.
 */
export function makeKit(lines: readonly Pick<ScaledLine, 'scaled'>[], steps: readonly string[], container: string | null): KitItem[] {
  const kit: KitItem[] = [];
  if (lines.some((l) => /\d\s*k?g$/.test(l.scaled))) kit.push({ name: 'Scale', equipment: 'scale' });
  const words = steps.join(' ');
  for (const [re, item] of KIT_WORDS) if (re.test(words)) kit.push(item);
  kit.push({ name: container ?? 'Bottle or tub' }, { name: 'Label' });
  return kit;
}

/** "Or weigh it: 332 g" for water by volume, which weighs a gram a millilitre. Nothing for anything else. */
export function weighHint(line: Pick<ScaledLine, 'name' | 'scaled'>): string | null {
  if (!/^(filtered |still |cold |hot |boiling )?water$/i.test(line.name.trim())) return null;
  const m = /^([\d.]+)\s*(ml|l)$/i.exec(line.scaled.trim());
  if (!m) return null;
  const g = Number(m[1]) * (m[2].toLowerCase() === 'l' ? 1000 : 1);
  return g > 0 ? `Or weigh it: ${g >= 1000 ? `${Math.round(g / 10) / 100} kg` : `${Math.round(g)} g`}` : null;
}

/** A step's first sentence is the thing to do; what follows is a quieter hint. */
export function splitHint(body: string): { main: string; hint: string | null } {
  const text = body.trim();
  const m = /^(.+?[.!?])\s+(?=[A-Z])(.+)$/s.exec(text);
  return m ? { main: m[1], hint: m[2].trim() } : { main: text, hint: null };
}

/** How far "What I have"'s − and + move: 50 for a big amount by weight or volume, 1 for counts and small ones. */
export function haveStep(value: number, unit: string | null): number {
  const measured = /^(g|kg|ml|cl|l|oz)$/i.test(unit ?? '');
  if (!measured || value < 20) return 1;
  return value >= 200 ? 50 : 10;
}

/** The next amount the stepper shows: on the step's grid, never below one step. */
export function stepHave(value: number, unit: string | null, dir: 1 | -1): number {
  const step = haveStep(value, unit);
  const snapped = dir > 0 ? Math.floor(value / step) * step + step : Math.ceil(value / step) * step - step;
  return Math.max(step, Math.round(snapped * 100) / 100);
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "Friday": the day whose colour the label's stripe takes. */
export function dayName(d: Date): string {
  return DAYS[d.getDay()];
}

/**
 * A QR matrix (toqr's flat 0/1 array, row by row) as one SVG path of unit
 * squares, with a quiet zone of `margin` modules. The same string draws the
 * label on screen (react-native-svg) and in the print window.
 */
export function qrPath(bits: ArrayLike<number>, margin = 2): { d: string; size: number } {
  const n = Math.round(Math.sqrt(bits.length));
  let d = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (bits[y * n + x]) d += `M${x + margin} ${y + margin}h1v1h-1z`;
    }
  }
  return { d, size: n + margin * 2 };
}
