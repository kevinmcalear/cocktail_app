/**
 * Learn (Kept-learn): the hub's kit rows and a technique's steps as drawn.
 * Pure, so lib/techniques/learn.check.ts can hold it to the board.
 */
import { EQUIPMENT, TECHNIQUES, unlocks } from './index';

/**
 * A step as the board draws it: the first sentence as its name, the rest
 * under it ("Pour it into whole milk" / "Punch into milk, never the other
 * way."). One sentence is all name.
 */
export function stepParts(text: string): { name: string; rest: string } {
  const at = text.search(/\.\s+(?=\S)/);
  if (at < 0) return { name: text.replace(/\.$/, ''), rest: '' };
  return { name: text.slice(0, at), rest: text.slice(at + 1).trim() };
}

export interface KitPick {
  id: string;
  name: string;
  have: boolean;
  /** Techniques owning it would open (0 for what you have). */
  opens: number;
}

/**
 * The hub's two kit rows: the piece on your shelf that the most techniques
 * need, then the piece you don't have that would open the most. With nothing
 * said yet, the two that would open the most.
 */
export function kitPicks(kit: ReadonlySet<string>): KitPick[] {
  const needs = (id: string) => TECHNIQUES.filter((t) => t.equipment.includes(id)).length;
  const byNeed = (a: { id: string }, b: { id: string }) => needs(b.id) - needs(a.id);
  const had = EQUIPMENT.filter((e) => kit.has(e.id)).sort(byNeed)[0];
  const away = EQUIPMENT.filter((e) => !kit.has(e.id))
    .map((e) => ({ e, opens: unlocks(e.id, kit) }))
    .filter((x) => x.opens > 0)
    .sort((a, b) => b.opens - a.opens || byNeed(a.e, b.e));
  const picks: KitPick[] = had ? [{ id: had.id, name: had.name, have: true, opens: 0 }] : [];
  for (const { e, opens } of away.slice(0, 2 - picks.length)) picks.push({ id: e.id, name: e.name, have: false, opens });
  return picks;
}

/** The pairing line on Learn: "Campari goes with Grapefruit in 38 drinks." */
export function pairLine(a: string, b: string, drinks: number): string {
  return `${a} goes with ${b} in ${drinks} ${drinks === 1 ? 'drink' : 'drinks'}.`;
}

/** Today's pick from a list, the same all day: Learn's pairing changes daily. */
export function pickOfDay<T>(list: readonly T[], day: Date): T | undefined {
  if (!list.length) return undefined;
  const start = Date.UTC(day.getFullYear(), 0, 0);
  const n = Math.floor((Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()) - start) / 86_400_000);
  return list[n % list.length];
}
