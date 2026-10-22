/**
 * "This is your bar. What next?" after venue setup (eddie-oct22-wave2, fix
 * 15): a few steps that fill in the bar's drawing, each one skippable.
 * Checked by lib/whatNext.check.ts.
 */
import { MOST_ASKED, foldName } from '@/lib/discover';
import type { ClaimState } from '@/lib/venueSetup';

/**
 * The steps, in order. ponytail: brands wait on the back bar's stock list
 * (fix 12, a migration); add 'brands' between these two once it lands.
 */
export const WHAT_NEXT_STEPS = ['glasses', 'menu'] as const;
export type WhatNextStep = (typeof WHAT_NEXT_STEPS)[number];

export const STEP_LABEL: Record<WhatNextStep, string> = { glasses: 'Glasses', menu: 'Menu' };

/** "1 of 2 · Glasses": the line over a step's title. */
export function stepProgress(step: WhatNextStep) {
  const at = WHAT_NEXT_STEPS.indexOf(step) + 1;
  const of = WHAT_NEXT_STEPS.length;
  return { at, of, label: `${at} of ${of} · ${STEP_LABEL[step]}`, name: 'What next' };
}

/** The first step not done or skipped, for "Start with glasses"; null when there's none left. */
export function nextStep(finished: readonly WhatNextStep[]): WhatNextStep | null {
  return WHAT_NEXT_STEPS.find((s) => !finished.includes(s)) ?? null;
}

/**
 * The classics a bar can start its menu from, as its own copies.
 * ponytail: Kevin picks the list (the board suggests the 20 most ranked, which
 * needs a count per classic the app doesn't keep yet). Until then: Discover's
 * most asked for, then the four with the most versions in the catalogue.
 */
export const STARTER_CLASSICS = [...MOST_ASKED, 'Gimlet', 'Cosmopolitan', 'Mai Tai', 'French 75'];

/** The starter classics the catalogue has, in the list's order. */
export function starterClassics<T extends { name: string }>(catalog: readonly T[]): T[] {
  const byName = new Map<string, T>();
  for (const c of catalog) if (!byName.has(foldName(c.name))) byName.set(foldName(c.name), c);
  return STARTER_CLASSICS.flatMap((n) => byName.get(foldName(n)) ?? []);
}

interface GroupableGlass {
  id: string;
  series: string | null;
  maker: { display_name: string } | null;
}

/**
 * Glasses in groups, in the order they came: by range ("Cocktail Kingdom ·
 * Leopold") for a search, by maker for a shape.
 */
export function groupGlasses<T extends GroupableGlass>(models: readonly T[], by: 'range' | 'maker'): { key: string; title: string; models: T[] }[] {
  const groups = new Map<string, { key: string; title: string; models: T[] }>();
  for (const m of models) {
    const maker = m.maker?.display_name ?? 'Other makers';
    const title = by === 'range' && m.series ? `${maker} · ${m.series}` : maker;
    const group = groups.get(title) ?? { key: title, title, models: [] };
    group.models.push(m);
    groups.set(title, group);
  }
  return [...groups.values()];
}

/** "Set up · 3 invites sent · page private until it's checked": the summary in one line. */
export function setupLine({ invites, claim, waitingFiles }: { invites: number; claim: ClaimState; waitingFiles: number }): string {
  return [
    'Set up',
    invites ? (invites === 1 ? 'one invite sent' : `${invites} invites sent`) : null,
    waitingFiles ? 'spec book waiting' : null,
    claim === 'none' ? 'page private until it’s checked' : claim === 'pending' ? 'claim being checked' : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** "Cocktail Kingdom, Libbey": who makes the bar's glasses, each once. */
export function makersLine(glasses: readonly { maker: string | null }[]): string | null {
  const makers = [...new Set(glasses.map((g) => g.maker?.trim()).filter((m): m is string => !!m))];
  return makers.length ? makers.join(', ') : null;
}
