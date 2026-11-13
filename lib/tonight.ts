// Tonight's lines (the canvas's Prod-today boards, renamed Tonight on 1 Nov
// 2026): what the staff page says before doors and what the home page says
// about the shelf. Plain functions so tonight.check.ts can hold them.

import { isGarnish } from './garnish';
import type { MakeLine } from './prep';
import { resolvePresentationIngredient, sortRecipesByOrder } from './recipeUtils';
import type { PresentationRecipe } from './spec';
import { dayMonth } from './dayMonth';

/** The service day ends at 6 the next morning (as useServiceDate counts it). */
export function serviceEnd(now: Date): Date {
  const end = new Date(now);
  if (end.getHours() >= 6) end.setDate(end.getDate() + 1);
  end.setHours(6, 0, 0, 0);
  return end;
}

/** Drinks on now that come off before the night is out (a planned take-off, menu_drinks.off_at). */
export function offTonight<T extends { offAt: string | null }>(drinks: readonly T[], now: Date): T[] {
  const end = serviceEnd(now).getTime();
  return drinks.filter((d) => d.offAt != null && Date.parse(d.offAt) <= end);
}

/**
 * The drink's garnishes for the service line, in spec order: count-unit lines
 * (a twist, a sprig), not an egg white counted "1 each".
 * ponytail: lane D2 (relaunch/d2-spec) adds garnishNames() to lib/specView.ts,
 * which also says "expressed and discarded" and "grated"; switch to it once it lands.
 */
export function garnishOf(lines: readonly { ingredient: string | null; unit: string | null | undefined }[]): string[] {
  return lines.filter((l) => l.ingredient && isGarnish(l.unit, l.ingredient)).map((l) => l.ingredient!);
}

/**
 * A drink's lines as names and units, in spec order: what Tonight reads from
 * the spec book without lib/spec's amounts (that stays out of the home page's
 * first load).
 */
export function recipeNames(recipes: readonly PresentationRecipe[] | null | undefined): { ingredient: string | null; unit: string | null }[] {
  return sortRecipesByOrder([...(recipes ?? [])]).map((r) => ({ ingredient: (resolvePresentationIngredient(r) as { name?: string } | null)?.name ?? null, unit: r.unit ?? null }));
}

/** "Comes off at 11pm". */
export const offAtLine = (offAt: string | null) => (offAt ? `Comes off at ${new Date(offAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : 'Off tonight');

/**
 * "Saturday 1 November", and "doors at 6pm" while the bar is closed and opens
 * later today, day before month in every locale (lib/dayMonth).
 */
export function tonightEyebrow(date: Date, opens: string | null, locale?: string): string {
  const day = dayMonth(date, { weekday: 'long', month: 'long' }, locale);
  // hoursStatus says "opens 6pm" today, "opens 6pm Thu" another day: only today's is doors.
  const today = opens && /^opens \S+$/.test(opens) ? `doors at ${opens.slice('opens '.length)}` : null;
  return [day, today].filter(Boolean).join(' · ');
}

/** A house-made line under Before doors: "Low · 200 ml left, Jack Rose needs it". */
export function prepLine(line: Pick<MakeLine, 'have' | 'needed' | 'forDrinks'>): string {
  const drink = line.forDrinks.find((d) => d !== 'back to par');
  const needs = drink ? `${drink} needs it` : 'back to par';
  if (line.have) return `Low · ${line.have.replace(/^have /, '')} left, ${needs}`;
  return `Make ${line.needed} · ${needs}`;
}

/** "Buy Green Chartreuse and you can make 4 more, the Last Word first." */
export function oneBottleLine(bottles: readonly { name: string }[], drinks: readonly { name: string }[]): string | null {
  if (!bottles.length || !drinks.length) return null;
  const buy = bottles.map((b) => b.name).join(' and ');
  const more = drinks.length === 1 ? `the ${drinks[0].name}` : `${drinks.length} more, the ${drinks[0].name} first`;
  return `Buy ${buy} and you can make ${more}.`;
}

/** The away group that opens the most drinks: the one bottle worth buying. */
export function bestAway<G extends { bottles: readonly unknown[]; drinks: readonly unknown[] }>(groups: readonly G[]): G | null {
  return groups.filter((g) => g.bottles.length === 1).reduce<G | null>((best, g) => (!best || g.drinks.length > best.drinks.length ? g : best), null);
}

export interface ShelfTile {
  id: string;
  name: string;
  /** "Ready", or "Need limes". */
  status: string;
  ready: boolean;
}

/** From your shelf's tiles: what you can make first, then one short of a single thing (a lime, a bottle). */
export function shelfTiles(
  canMake: readonly { id: string; name: string }[],
  oneAway: readonly { bottles: readonly { name: string }[]; drinks: readonly { id: string; name: string }[] }[],
  count = 6
): ShelfTile[] {
  const ready = canMake.slice(0, count).map((d) => ({ id: d.id, name: d.name, status: 'Ready', ready: true }));
  const seen = new Set(ready.map((t) => t.id));
  const need = oneAway
    .flatMap((g) => g.drinks.map((d) => ({ id: d.id, name: d.name, status: `Need ${needName(g.bottles[0]?.name ?? '')}`, ready: false })))
    .filter((t) => !seen.has(t.id) && (seen.add(t.id), true));
  // Mostly ready, with a near one or two among them, as the board draws.
  const near = Math.max(1, Math.floor(count / 3));
  return [...ready.slice(0, count - Math.min(near, need.length)), ...need].slice(0, count);
}

/** "Fresh lime juice" reads "limes"; a bottle keeps its name. */
function needName(name: string): string {
  const fruit = /^(?:fresh\s+)?(lime|lemon|orange|grapefruit)(?:\s+juice)?$/i.exec(name.trim());
  return fruit ? `${fruit[1].toLowerCase()}s` : name;
}

/** A run-through's length: about 20 seconds a line of the spec, at least a minute. `line` is the menu's "Gin, lemon, honey". */
export function runThroughMinutes(line: string): number {
  const lines = line.split(/,\s*/).filter(Boolean).length;
  return Math.max(1, Math.round((lines * 20) / 60));
}

/** Allergens worth a word at the table first: eggs (raw egg white) and milk lead, then the rest in the regulated order. */
const TALK_FIRST = ['eggs', 'milk'];

/**
 * Learn's talk-through row: the first drink on tonight's lists with an
 * allergen to explain, and what to call it ("Raw egg white: what to tell
 * guests"): the ingredient it comes through when known, else the allergen.
 */
export function talkThrough(
  drinks: readonly { id: string; name: string }[],
  allergens: (id: string) => { allergen: string; via: string[][] }[] | undefined,
  label: (key: string) => string
): { id: string; name: string; sub: string } | null {
  let best: { id: string; name: string; sub: string; rank: number } | null = null;
  for (const d of drinks) {
    const talk = talkAbout(allergens(d.id), label);
    if (talk && (!best || talk.rank < best.rank)) best = { id: d.id, name: d.name, sub: `${talk.word}: what to tell guests`, rank: talk.rank };
  }
  return best && { id: best.id, name: best.name, sub: best.sub };
}

/** One drink's allergen worth a word at the table, by what it comes through ("Raw egg white"), eggs and milk first. */
export function talkAbout(allergens: readonly { allergen: string; via: string[][] }[] | undefined, label: (key: string) => string): { word: string; rank: number } | null {
  const rank = (key: string) => (TALK_FIRST.includes(key) ? TALK_FIRST.indexOf(key) : TALK_FIRST.length);
  let best: { word: string; rank: number } | null = null;
  for (const a of allergens ?? []) {
    const r = rank(a.allergen);
    if (best && best.rank <= r) continue;
    best = { word: a.via[0]?.[a.via[0].length - 1] ?? label(a.allergen), rank: r };
  }
  return best;
}

/** House-made used tonight that needs no batch: "1.2 L · enough for tonight" rows, for what has been counted or logged. */
export function enoughRows(
  houseMadeIds: readonly string[],
  make: readonly { id: string }[],
  onHand: Readonly<Record<string, { value: number }>>,
  name: (id: string) => string | undefined,
  have: (id: string) => string
): { id: string; name: string; sub: string }[] {
  const making = new Set(make.map((m) => m.id));
  return houseMadeIds
    .filter((id) => !making.has(id) && onHand[id] && onHand[id].value > 0 && name(id))
    .map((id) => ({ id, name: name(id)!, sub: `${have(id)} · enough for tonight` }));
}

/** How many of a list's drinks print no price (Needs you: "1 drink has no price"). */
export function unpriced(drinks: readonly { price: string | null; menuPrice?: string | null }[], printed: (d: { price: string | null; menuPrice?: string | null }) => string | null): number {
  return drinks.filter((d) => !printed(d)).length;
}

/**
 * On shift: who's working tonight ("Ana, Theo and you") and who opens and
 * closes ("Theo opens · you close"). First names; you last as "you".
 */
export function onShiftLine(
  shifts: readonly { user_id: string; opens: boolean; closes: boolean }[],
  nameOf: (userId: string) => string,
  me: string | null
): { names: string; sub: string | null } | null {
  const ids = [...new Set(shifts.map((s) => s.user_id))];
  if (!ids.length) return null;
  const call = (id: string) => (id === me ? 'you' : nameOf(id).split(' ')[0]);
  const ordered = [...ids.filter((id) => id !== me), ...ids.filter((id) => id === me)].map(call);
  const names = ordered.length === 1 ? ordered[0] : `${ordered.slice(0, -1).join(', ')} and ${ordered[ordered.length - 1]}`;
  const opener = shifts.find((s) => s.opens);
  const closer = shifts.find((s) => s.closes);
  const parts = [opener ? `${call(opener.user_id)} open${opener.user_id === me ? '' : 's'}` : null, closer ? `${call(closer.user_id)} close${closer.user_id === me ? '' : 's'}` : null].filter(Boolean);
  const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  return { names: sentence(names), sub: parts.length ? sentence(parts.join(' · ')) : null };
}
