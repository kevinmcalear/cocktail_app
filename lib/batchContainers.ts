/**
 * Batching a drink made in parts with every part made ahead (board
 * made-parts-making, "Batch, every part made ahead", approved 27 Oct 2026):
 * part 1 goes in the bottle as before (lib/batch.ts), and each later part
 * that isn't made fresh goes in its own container, scaled to the same
 * serves, with its own size and use-by. At the station each serve pours
 * from each in order. Pure; components/screens/batch renders it.
 */
import { buildBatch, clampServes, formatVolume, guessLeaveOut, type BatchLine, type LeaveOut, type VolumeUnit } from './batch';
import { expiryLine } from './batchPrep';
import { byPart, joinStep, type MakingPart } from './drinkParts';
import type { SpecLine } from './spec';

// --- containers ---

export type Container = { ml: number; name: string };

/** What a part goes in when the venue's Kit lists no containers: the smallest that holds it, in this order on a tie. */
export const CONTAINERS: readonly Container[] = [
  { ml: 500, name: '500 ml squeeze bottle' },
  { ml: 500, name: '500 ml deli container' },
  { ml: 1000, name: '1 L deli container' },
  { ml: 700, name: '700 ml bottle' },
  { ml: 750, name: '750 ml bottle' },
];

const CONTAINER_WORD = /bottle|deli|container|jar|tub|cambro|carafe|jug|squeeze/i;
// Bar tools that hold liquid but aren't where a part is kept.
const NOT_STORAGE = /shaker|tin|mixing|jigger|glass|pitcher|dasher|dropper|atomi[sz]er/i;
const VOLUME = /(\d+(?:[.,]\d+)?)\s*(ml|millilit(?:re|er)s?|l|lit(?:re|er)s?|oz|fl\.? ?oz|qt|quarts?|pints?|pt)\b/i;
const UNIT_ML: [RegExp, number][] = [[/^m/i, 1], [/^(l|lit)/i, 1000], [/oz$/i, 29.5735], [/^(qt|quart)/i, 946], [/^(pt|pint)/i, 473]];

/**
 * A container from the venue's Kit, by the name it was given there ("1 L deli",
 * "Squeeze bottle 16 oz", "Quart deli"), or null when the name isn't a container
 * with a size.
 * ponytail: reads sizes out of Kit tool names; give bar_kit a capacity column when a bar lists containers with no size in the name.
 */
export function ownContainer(name: string): Container | null {
  const said = name.trim();
  if (!CONTAINER_WORD.test(said) || NOT_STORAGE.test(said)) return null;
  const m = VOLUME.exec(said);
  const word = /\b(quart|pint)\b/i.exec(said)?.[1];
  const per = m ? UNIT_ML.find(([re]) => re.test(m[2]))?.[1] : word ? (word.toLowerCase() === 'quart' ? 946 : 473) : undefined;
  const ml = per ? Math.round((m ? Number(m[1].replace(',', '.')) : 1) * per) : 0;
  return ml > 0 ? { ml, name: said } : null;
}

/** A whipped part sits in a tub, never a bottle (the board's cream goes in a deli container). */
const suits = (c: Container, whipped: boolean) => !whipped || !/bottle/i.test(c.name);

/**
 * What a part of `ml` goes in: the venue's own containers if its Kit lists
 * any, else ours; the smallest that holds it all, or as many of the biggest
 * as it takes.
 */
export function pickContainer(ml: number, own: readonly Container[], whipped: boolean): { count: number; container: Container } {
  const mine = own.filter((c) => suits(c, whipped));
  const list = mine.length ? mine : CONTAINERS.filter((c) => suits(c, whipped));
  const one = [...list].sort((a, b) => a.ml - b.ml).find((c) => c.ml >= ml);
  if (one) return { count: 1, container: one };
  const big = list.reduce((a, b) => (b.ml > a.ml ? b : a));
  return { count: Math.max(1, Math.ceil(ml / big.ml)), container: big };
}

/** "1 × 500 ml deli container". */
export const containerText = (count: number, c: Container) => `${count} × ${c.name}`;

// --- use-by ---

/** "Close tonight": a part with cream, egg or juice in it keeps for one service. */
export const TONIGHT_HOURS = 12;
/** What a use-by can be changed to. */
export const USE_BY_HOURS: readonly number[] = [TONIGHT_HOURS, 24, 72, 168, 336, 672];

/** How long a part keeps: the shortest of its house-made lines' shelf lives, and close tonight with cream, egg or fresh juice in it. Null when nothing in it says (spirits keep). */
export function partKeeps(lines: readonly SpecLine[], lives: Readonly<Record<string, number>>): number | null {
  const hours = lines.flatMap((l) => {
    const life = l.houseMade && l.ingredientId ? lives[l.ingredientId] : undefined;
    if (life) return [life];
    const why = guessLeaveOut(l.ingredient ?? '', (l.unit ?? '').toLowerCase());
    return why === 'dairy' || why === 'citrus' ? [TONIGHT_HOURS] : [];
  });
  return hours.length ? Math.min(...hours) : null;
}

/** "close tonight", "1 day", "2 weeks": a use-by choice. */
export function keepsLabel(hours: number): string {
  if (hours <= TONIGHT_HOURS) return 'close tonight';
  const days = Math.round(hours / 24);
  if (days >= 7 && days % 7 === 0) return `${days / 7} week${days === 7 ? '' : 's'}`;
  return `${days} day${days === 1 ? '' : 's'}`;
}

/** "use by close tonight", "use by Mon 10 Nov"; null with no use-by. */
export function expiresText(hours: number | null, today: Date): string | null {
  if (!hours) return null;
  return hours <= TONIGHT_HOURS ? 'use by close tonight' : expiryLine(expiresOn(hours, today));
}

/** The day to use it by: tonight is today. */
export const expiresOn = (hours: number, made: Date): Date => (hours <= TONIGHT_HOURS ? made : new Date(made.getTime() + hours * 3600 * 1000));

// --- the parts ---

/** A later part made ahead: what goes in its container for the serves, and what's still added per serve. */
export interface AheadPart {
  part: MakingPart;
  /** In the container, scaled to the serves. */
  rows: BatchLine[];
  /** Added at the station for each serve: a count (a twist), bubbles, or a line the bar keeps at the station. */
  perServe: BatchLine[];
  /** The part's own lines, for its use-by. */
  lines: SpecLine[];
  totalMl: number;
  total: string;
  pour: string;
  whipped: boolean;
}

/** Made ahead, it has its own container; made fresh, it's made for each serve as before (#964). The first part is the bottle. */
export const madeAhead = (p: MakingPart) => p.n > 1 && !p.fresh;

/** What never goes in a part's container: a garnish, the bubbles, and what the bar keeps at the station. Cream and juice do: they're made ahead too. */
const AT_STATION: readonly (LeaveOut | null)[] = ['garnish', 'bubbles', 'station'];

/**
 * Each later part made ahead, scaled to `serves`: every measured line goes in
 * its container (the cream is whipped ahead), but bubbles, garnishes and lines
 * the bar set to the station stay per serve. A part with nothing to keep has
 * no container and reads as made fresh.
 */
export function aheadParts(lines: readonly SpecLine[], parts: readonly MakingPart[], serves: number, unit: VolumeUnit): AheadPart[] {
  const grouped = byPart(lines, parts.length);
  const n = clampServes(serves);
  return parts.filter(madeAhead).flatMap((part) => {
    const own = grouped[part.n - 1];
    const station = new Set(own.filter((l) => l.atService === true).map((l) => l.key));
    const scaled = buildBatch(own, [], n, { unit }).lines;
    const rows = scaled.filter((l) => l.ml !== null && !AT_STATION.includes(l.leaveOut) && !station.has(l.key));
    if (!rows.length) return [];
    const totalMl = rows.reduce((sum, l) => sum + l.ml!, 0);
    return [{
      part,
      rows,
      perServe: scaled.filter((l) => !rows.includes(l)),
      lines: own,
      totalMl,
      total: formatVolume(totalMl, unit),
      pour: formatVolume(totalMl / n, unit),
      whipped: part.methods.some((m) => /whip/i.test(m)),
    }];
  });
}

/** "The cream" is "cream", for "the cream container". */
export const partWord = (name: string) => name.trim().replace(/^the\s+/i, '').toLowerCase();

/** How a part made ahead reads at the station: "From its container, already whipped". */
export function fromContainer(methods: readonly string[]): string {
  const all = methods.join(' ').toLowerCase();
  const done = /whip/.test(all) ? 'whipped' : /shak/.test(all) ? 'shaken' : /stir/.test(all) ? 'stirred' : /blend/.test(all) ? 'blended' : null;
  return done ? `From its container, already ${done}` : 'From its container, made ahead';
}

/** One part as the "In order" list reads it. */
export type OrderPart = {
  part: MakingPart;
  /** Poured from the bottle (part 1) or its container (a part made ahead); null when made fresh. */
  pour: string | null;
  /** What's added for each serve, or a fresh part's lines. */
  lines: readonly { amount: string; ingredient: string }[];
  whipped?: boolean;
};

const said = (l: { amount: string; ingredient: string }) => [l.amount, l.ingredient].filter(Boolean).join(' ');

/**
 * The station's numbered list, one line a step, in order (board made-parts-making):
 * "Pour 55 ml from the coffee bottle", "Add 120 ml Hot coffee",
 * "Spoon 30 ml from the cream container", "Float it on top".
 */
export function inOrderSteps(parts: readonly OrderPart[]): string[] {
  return parts.flatMap(({ part, pour, lines, whipped }) => {
    const word = partWord(part.name);
    const join = joinStep(part.join);
    const fresh = part.n > 1 && !pour;
    const first = pour
      ? [`${whipped ? 'Spoon' : 'Pour'} ${pour} from the ${word} ${part.n === 1 ? 'bottle' : 'container'}`]
      : fresh
        ? [`Make ${word} fresh${lines.length ? `: ${lines.map(said).join(', ')}` : ''}`]
        : [];
    const adds = fresh ? [] : lines.map((l) => `Add ${said(l)}`);
    return [...first, ...adds, ...(join ? [join] : [])];
  });
}
