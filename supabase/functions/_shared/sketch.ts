/**
 * The AI half of a drink's drawing inputs: the prompt lines and the answer
 * parsing for the flavor-worker. The rules themselves are in sketchRules.ts,
 * which the app runs too; this file re-exports them so the worker has one
 * import.
 */
import {
  DRINK_COLOR_NAMES,
  DRINK_COLORS,
  FOAMS,
  GARNISHES,
  GLASSES,
  ICES,
  METHODS,
  garnishFromText,
  glassFromName,
  iceFromName,
  methodFromNames,
  type DrinkLook,
  type IngredientLook,
  type SketchDrink,
} from './sketchRules.ts';

export * from './sketchRules.ts';

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const round3 = (n: number) => Math.round(n * 1000) / 1000;


/** Extra lines for the flavor-worker's AI prompt: what each ingredient looks like, and the drink as a whole when asked. */
export function sketchPromptAddendum(drink: SketchDrink | null): string[] {
  const out = [
    'Besides those numbers, give each ingredient: color, the liquid\'s colour as poured as "#rrggbb"; tint, 0 to 1, how strongly it colours a drink (0 for a clear spirit or syrup, 1 for Campari or espresso);',
    `and foam, one of ${FOAMS.join(', ')} if shaking it makes that kind of foam (egg white: cap, espresso: crema, pineapple: froth, cream: silk, citrus: sheen), else null.`,
  ];
  if (drink) {
    out.push(
      'Also add a "drink" object describing how this drink is served:',
      `{"glass": one of ${GLASSES.join(', ')}; "ice": one of ${ICES.join(', ')}; "method": one of ${METHODS.join(', ')};`,
      `"garnish": one of ${GARNISHES.join(', ')} or null; "color": the finished drink's colour, one of ${DRINK_COLOR_NAMES.join(', ')}`,
      '(pick the closest real colour from its ingredients and style; clear for colourless drinks); '
        + `"foam": one of ${FOAMS.join(', ')} or null}.`,
      'Judge from the name, description and ingredients, the way a bartender would serve it.',
      `Drink: ${JSON.stringify({ name: drink.name, description: (drink.description ?? '').slice(0, 600), ingredients: drink.lines.map((l) => l.name).slice(0, 20) })}`,
    );
  }
  return out;
}

const pick = <T extends string>(list: readonly T[], v: unknown): T | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return (list as readonly string[]).includes(t) ? (t as T) : undefined;
};
/** A colour as '#rrggbb', from '#RRGGBB' or '#rgb'. */
const hexOf = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(t)) return t;
  if (/^#[0-9a-f]{3}$/.test(t)) return '#' + [...t.slice(1)].map((c) => c + c).join('');
  return undefined;
};

/** A drink colour from its name; a bare hex is kept unless it's the pure black or white the model falls back to. */
const drinkColorOf = (v: unknown): string | undefined => {
  const name = pick(DRINK_COLOR_NAMES, v);
  if (name) return DRINK_COLORS[name].toLowerCase();
  const hex = hexOf(v);
  return hex && hex !== '#000000' && hex !== '#ffffff' ? hex : undefined;
};

/**
 * The shape the model must answer in (Gemini's responseSchema), so every
 * enum comes back from its list. Taste dimensions come from flavor.ts.
 */
export function aiAnswerSchema(tasteDimensions: readonly string[], withDrink: boolean): Record<string, unknown> {
  const str = (values?: readonly string[], nullable = false) => ({ type: 'STRING', ...(values ? { enum: [...values] } : {}), ...(nullable ? { nullable: true } : {}) });
  const num = { type: 'NUMBER' };
  const ingredient = {
    type: 'OBJECT',
    properties: {
      id: str(), abv: num, ...Object.fromEntries(tasteDimensions.map((d) => [d, num])),
      color: str(), tint: num, foam: str(FOAMS, true),
    },
    required: ['id', 'abv', ...tasteDimensions, 'color', 'tint'],
  };
  const drink = {
    type: 'OBJECT',
    properties: {
      glass: str(GLASSES), ice: str(ICES), method: str(METHODS), garnish: str(GARNISHES, true), color: str(DRINK_COLOR_NAMES), foam: str(FOAMS, true),
    },
    required: ['glass', 'ice', 'method', 'color'],
  };
  return {
    type: 'OBJECT',
    properties: { ingredients: { type: 'ARRAY', items: ingredient }, ...(withDrink ? { drink } : {}) },
    required: withDrink ? ['ingredients', 'drink'] : ['ingredients'],
  };
}

/** Reads the colour half of the AI fill's answer per asked id. Anything off-list is dropped. */
export function parseAiLooks(text: string, askedIds: readonly string[]): Map<string, IngredientLook> {
  const out = new Map<string, IngredientLook>();
  let data: unknown;
  try { data = JSON.parse(text); } catch { return out; }
  const rows = (data as { ingredients?: unknown })?.ingredients;
  if (!Array.isArray(rows)) return out;
  const asked = new Set(askedIds);
  for (const row of rows as Record<string, unknown>[]) {
    const id = typeof row?.id === 'string' ? row.id : null;
    const color = hexOf(row.color);
    if (!id || !asked.has(id) || out.has(id) || !color) continue;
    const tint = typeof row.tint === 'number' && Number.isFinite(row.tint) ? round3(clamp01(row.tint)) : 0.3;
    out.set(id, { color, tint, foam: pick(FOAMS, row.foam) ?? null });
  }
  return out;
}

/** Reads the drink half of the AI fill's answer. Only listed values survive. */
export function parseAiDrink(text: string): DrinkLook | null {
  let data: unknown;
  try { data = JSON.parse(text); } catch { return null; }
  const d = (data as { drink?: Record<string, unknown> })?.drink;
  if (!d || typeof d !== 'object') return null;
  // Near misses ("Coupe glass", "large cube") are read the way the drink's own data is.
  const said = (v: unknown) => (typeof v === 'string' ? v : '');
  const look: DrinkLook = {
    glass: pick(GLASSES, d.glass) ?? glassFromName(said(d.glass)) ?? undefined,
    ice: pick(ICES, d.ice) ?? iceFromName(said(d.ice)) ?? undefined,
    method: pick(METHODS, d.method) ?? methodFromNames([said(d.method)]) ?? undefined,
    garnish: pick(GARNISHES, d.garnish) ?? (said(d.garnish) ? garnishFromText(said(d.garnish)) : null),
    color: drinkColorOf(d.color),
    foam: pick(FOAMS, d.foam) ?? null,
  };
  return look.glass || look.ice || look.method || look.color ? look : null;
}
