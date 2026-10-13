import { useItemFlavors, useItemScores, useMyTaste } from '@/hooks/useFlavor';
import { useKit } from '@/hooks/useKit';
import { useFinishBottle, useMadePreps, useMyBar, usePantryItems, usePrepDetails, useShelfEdit, useShortPreps, type BarItem } from '@/hooks/useHomeBar';
import { useTechniqueDrinks } from '@/hooks/useTechniqueDrinks';
import { COLD_START_DRINKS, matchPercent } from '@/lib/flavor';
import { SHELF_SECTIONS, type ShelfSection } from '@/lib/myBarRows';
import { inSentence, prepMeta, tickNames } from '@/lib/myBarText';
import { PANTRY_WATER } from '@/lib/pantry';
import { equipmentById } from '@/lib/techniques';
import { waysToMake } from '@/lib/techniques/makeIt';
import { labFromNames, projectsFor } from '@/lib/techniques/projects';

import type { PrepShort, PrepToMake } from './MakeFirst';
import type { MakeRowText } from './MakeRows';

/**
 * Everything My Bar shows, worked out from the shelf: the sections and their
 * counts, what to make and its row text, Make first and One thing short,
 * Projects and the drinks they go into, each house prep's keep and each lab
 * bottle's preps. `query`: What to make's search, lit in rows. `projectsOpen`:
 * the Projects tab is showing, so its drinks are worth loading.
 */
export function useMyBarData({ query, projectsOpen }: { query: string; projectsOpen: boolean }) {
  const bar = useMyBar();
  const pantry = usePantryItems();
  const { add, remove } = useShelfEdit();
  const finish = useFinishBottle();
  const { owned, toggle: toggleKit } = useKit();

  // Staples live on the shelf too, but are listed as Fridge & pantry chips; the rest go by section.
  const staples = new Set((pantry.data ?? []).map((p) => p.id));
  const listed = bar.shelf.filter((b) => !staples.has(b.id));
  const bottles = listed.filter((b) => b.section === 'bottles');
  const fridge = listed.filter((b) => b.section === 'fridge');
  const lab = listed.filter((b) => b.section === 'lab');
  const preps = listed.filter((b) => b.section === 'preps');
  // Water comes with the staples but is never shown, so it isn't counted.
  const fridgeCount = (pantry.data ?? []).filter((p) => p.name !== PANTRY_WATER && bar.shelfIds.has(p.id)).length + fridge.length;
  const counts: Record<ShelfSection, number> = { bottles: bottles.length, fridge: fridgeCount, lab: lab.length, preps: preps.length, kit: owned.length };
  const filled = SHELF_SECTIONS.filter((s) => counts[s] > 0);

  // A shelf row as it reads in a sentence: "lemon", "Woodford Reserve".
  const shelfById = new Map(bar.shelf.map((s) => [s.id, s]));
  const ticks = (ids: readonly string[]) =>
    tickNames(ids.flatMap((id) => {
      const s = shelfById.get(id);
      return s && s.name !== PANTRY_WATER ? [{ name: s.name, generic: s.role === 'generic', kind: s.kind, maker: s.maker }] : [];
    }));

  // Make first: preps the shelf covers but you haven't made, kept to the ready drinks that need them.
  const made = useMadePreps();
  const shortRows = useShortPreps().data ?? [];
  const firstBase = (made.data ?? [])
    .map((p) => {
      const needs = new Set(p.drinks);
      return { id: p.id, name: p.name, drinks: bar.canMake.filter((d) => needs.has(d.id)) };
    })
    .filter((p) => p.drinks.length)
    .sort((a, b) => b.drinks.length - a.drinks.length);
  // One thing short: the drinks one away for that one ingredient that use the prep.
  const singles = new Map(bar.oneAway.filter((g) => g.bottles.length === 1).map((g) => [g.bottles[0].id, g.drinks]));
  const short: PrepShort[] = shortRows
    .map((p) => {
      const uses = new Set(p.drinks);
      return { id: p.id, name: p.name, missing: { id: p.missing_id, name: p.missing_name }, drinks: (singles.get(p.missing_id) ?? []).filter((d) => uses.has(d.id)) };
    })
    .filter((p) => p.drinks.length)
    .sort((a, b) => b.drinks.length - a.drinks.length)
    .slice(0, 5);

  const details = usePrepDetails([...firstBase.map((p) => p.id), ...short.map((p) => p.id), ...preps.map((p) => p.id)]).data;
  const technique = (name: string) => waysToMake(name)[0];
  const toMake: PrepToMake[] = firstBase.map((p) => {
    const t = technique(p.name);
    const d = details?.[p.id];
    const kit = (t?.equipment ?? []).filter((id) => owned.includes(id)).flatMap((id) => equipmentById(id)?.name ?? []);
    return { ...p, meta: prepMeta(d?.lead ?? t?.time, d?.keepsHours ?? t?.keepsHours), has: [...(d?.lines ?? []).map((l) => inSentence(l.name, l.generic)), ...kit] };
  });
  const keeps = Object.fromEntries(preps.map((p) => [p.id, details?.[p.id]?.keepsHours ?? technique(p.name)?.keepsHours ?? null]));
  // How many of your preps (made, to make, or one short) each lab bottle goes into.
  const prepUses: Record<string, number> = {};
  for (const id of new Set([...firstBase.map((p) => p.id), ...short.map((p) => p.id), ...preps.map((p) => p.id)])) {
    for (const lid of new Set((details?.[id]?.lines ?? []).map((l) => l.id))) prepUses[lid] = (prepUses[lid] ?? 0) + 1;
  }

  // Under a ready drink: the prep to make first, else the house prep of yours it uses (g147, kept).
  const notes = new Map<string, string>();
  for (const p of toMake) for (const d of p.drinks) if (!notes.has(d.id)) notes.set(d.id, `Make the ${p.name} first`);
  const prepNames = new Map(preps.map((p) => [p.id, p.name]));
  for (const d of bar.canMake) {
    const mine = d.shelfUses?.find((id) => prepNames.has(id));
    if (mine && !notes.has(d.id)) notes.set(d.id, `With your ${prepNames.get(mine)}`);
  }

  // Each row: its score at the end with % match under it (only past the cold start, g145).
  const { data: me } = useMyTaste();
  const scored = me && me.basis === 'ranked' && me.rankedDrinks >= COLD_START_DRINKS ? me.taste : null;
  const makeIds = [...bar.canMake, ...[...bar.oneAway, ...bar.twoAway].flatMap((g) => g.drinks)].map((d) => d.id);
  const profiles = useItemFlavors(makeIds, !!scored);
  const scores = useItemScores(makeIds).data;
  const bottleIds = new Set(bottles.map((b) => b.id));
  const text: MakeRowText = {
    matchFor: (id) => {
      const profile = scored && profiles.data?.[id];
      return profile ? `${matchPercent(scored, profile)}% match` : undefined;
    },
    noteFor: (id) => notes.get(id),
    scoreFor: (id) => scores?.[id],
    usesFor: (d: BarItem) => ticks(d.shelfUses ?? []),
    bottlesFor: (d: BarItem) => ticks((d.shelfUses ?? []).filter((id) => bottleIds.has(id))),
    query: query.trim() || undefined,
  };

  // Projects need kit or a lab shelf to mean anything; until then the tab isn't offered.
  const projects = owned.length || lab.length ? projectsFor(new Set(owned), labFromNames(lab.map((l) => l.name))) : null;
  const techniques = projects ? [...projects.ready.map((p) => p.technique), ...projects.away.flatMap((a) => a.techniques)] : [];
  const projectDrinks = useTechniqueDrinks(techniques, projectsOpen).data;
  // Kit that opens projects says how many.
  const opens: Record<string, number> = {};
  for (const p of projects?.ready ?? []) for (const id of p.technique.equipment) opens[id] = (opens[id] ?? 0) + 1;

  return {
    bar,
    pantry: pantry.data ?? [],
    addIds: add.mutate,
    removeId: remove.mutate,
    finishId: finish.mutate,
    owned,
    toggleKit,
    bottles,
    fridge,
    lab,
    preps,
    fridgeCount,
    counts,
    filled,
    toMake,
    short,
    keeps,
    prepUses,
    text,
    projects,
    projectDrinks,
    opens,
  };
}
