/**
 * The service spec: which lines of a drink go in the batch and which are
 * added at the station, the batch pour that follows, and the card a station
 * sheet shows for each drink on tonight's menu. Pure; the drink page's
 * Service section and the station sheet render it.
 *
 * A line's place comes from recipes.at_service when the bar has decided, and
 * from the name-matching guess in lib/batch.ts until then, so the drink page
 * and Batch can never disagree.
 */

import { formatVolume, isGarnishUnit, leaveOutFor } from '@/lib/batch';
import { toQuantity } from '@/lib/quantity';
import type { SpecLine } from '@/lib/spec';

export type ServiceStyle = 'a_la_minute' | 'batched' | 'bottled' | 'carbonated' | 'draught';

export const SERVICE_STYLES: readonly { value: ServiceStyle; label: string; brief: string }[] = [
  { value: 'a_la_minute', label: 'À la minute', brief: 'Made to order, every line at the station' },
  { value: 'batched', label: 'Batched', brief: 'Poured from a batch, finished at the station' },
  { value: 'bottled', label: 'Bottled', brief: 'A finished drink in its own bottle' },
  { value: 'carbonated', label: 'Carbonated', brief: 'Force-carbonated, poured from the bottle' },
  { value: 'draught', label: 'On draught', brief: 'Poured from a keg or tap' },
];

export function serviceStyleLabel(style: string | null | undefined): string | null {
  return SERVICE_STYLES.find((s) => s.value === style)?.label ?? null;
}

export function isServiceStyle(value: unknown): value is ServiceStyle {
  return SERVICE_STYLES.some((s) => s.value === value);
}

export interface ServiceLine {
  key: string;
  ingredient: string;
  /** "22.5 ml", or "" when there's no amount. */
  amount: string;
  /** Nobody has decided this line yet; its place is a guess from the name. */
  guessed: boolean;
  garnish: boolean;
}

export interface ServiceSpec {
  batch: ServiceLine[];
  station: ServiceLine[];
  /** The batched lines that measure in ml, added up; null when none do. */
  pourMl: number | null;
  /** The batched lines that weigh in g, added up; null when none do. */
  pourG: number | null;
  /** "67 ml", "67 ml + 5 g", or null with nothing measured. */
  pour: string | null;
  /** Whole serves from a bottle of each size, from the pour. */
  servesPerBottle: { ml750: number; l1: number } | null;
  /** Every line is still a guess: nobody has set the service spec. */
  allGuessed: boolean;
}

/** Added at the station, by decision or by the guess. */
export function isAtStation(line: SpecLine): boolean {
  return leaveOutFor(line.ingredient ?? '', (line.unit ?? '').toLowerCase(), line.atService) !== null;
}

function toServiceLine(line: SpecLine): ServiceLine {
  return {
    key: line.key,
    ingredient: line.ingredient ?? 'Hidden ingredient',
    amount: line.amount ?? '',
    guessed: line.atService === null,
    garnish: isGarnishUnit(line.unit),
  };
}

const round = (n: number) => Math.round(n * 10) / 10;

export function serviceSpec(lines: SpecLine[]): ServiceSpec {
  const batch = lines.filter((l) => !isAtStation(l));
  const station = lines.filter((l) => isAtStation(l));
  let pourMl: number | null = null;
  let pourG: number | null = null;
  for (const l of batch) {
    const q = toQuantity(l.value, l.unit);
    if (q?.kind === 'ml') pourMl = (pourMl ?? 0) + q.value;
    if (q?.kind === 'g') pourG = (pourG ?? 0) + q.value;
  }
  const parts = [pourMl !== null ? formatVolume(pourMl, 'ml') : null, pourG !== null ? `${round(pourG)} g` : null].filter(Boolean);
  return {
    batch: batch.map(toServiceLine),
    station: station.map(toServiceLine),
    pourMl,
    pourG,
    pour: parts.length ? parts.join(' + ') : null,
    servesPerBottle: pourMl && pourMl > 0 ? { ml750: Math.floor(750 / pourMl), l1: Math.floor(1000 / pourMl) } : null,
    allGuessed: lines.length > 0 && lines.every((l) => l.atService === null),
  };
}

/** "A 750 ml bottle is 11 serves", or null when there's no pour. */
export function bottleLine(spec: ServiceSpec): string | null {
  if (!spec.servesPerBottle || !spec.pourMl) return null;
  const n = spec.servesPerBottle.ml750;
  return `A 750 ml bottle is ${n} ${n === 1 ? 'serve' : 'serves'}`;
}

export interface StationCard {
  id: string;
  name: string;
  style: ServiceStyle | null;
  /** "Shake · Coupe · No ice", from whatever is set. */
  how: string;
  /** "67 ml batch", or null for a drink made entirely at the station. */
  pour: string | null;
  /** "24 ml Lime juice", in spec order; liquids and bitters only. */
  adds: string[];
  garnish: string[];
}

/** The card the station sheet shows for one drink. Amounts may be blank for roles below the measurement level. */
export function stationCard(
  drink: { id: string; name: string; style: string | null; method: string | null; glass: string | null; ice: string | null },
  lines: SpecLine[]
): StationCard {
  const spec = serviceSpec(lines);
  const label = (l: ServiceLine) => [l.amount, l.ingredient].filter(Boolean).join(' ');
  // A bottled or carbonated drink is poured whole, so a pour with nothing added
  // reads "93 ml from the bottle"; a batched one reads "67 ml batch".
  const whole = (drink.style === 'bottled' || drink.style === 'carbonated' || drink.style === 'draught') && spec.station.length === 0;
  return {
    id: drink.id,
    name: drink.name,
    style: isServiceStyle(drink.style) ? drink.style : null,
    how: [drink.method, drink.glass, drink.ice].filter((x): x is string => !!x).join(' · '),
    pour: spec.pour ? `${spec.pour} ${whole ? 'from the bottle' : spec.batch.length === lines.length ? 'batch, nothing added' : 'batch'}` : null,
    adds: spec.station.filter((l) => !l.garnish).map(label),
    garnish: spec.station.filter((l) => l.garnish).map(label),
  };
}
