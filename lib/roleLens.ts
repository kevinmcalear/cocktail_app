// What each role opens on a venue drink (boards drink-role-lens and the
// drink page More menu's View as). Default levels: a venue can move specs to
// another role (bars.measurement_level), and its own roles can grant or
// revoke the overridable parts, so the page itself always asks the server.

import { ROLE_LEVELS } from './roles';

/** One line per role for View as: what it adds over the one below. */
export const ROLE_ADDS: Record<number, string> = {
  10: 'The menu description, flavor and backstory. Everything else stays collapsed.',
  20: 'Adds talking points, allergens, service and where it lives.',
  30: 'Adds the spec, method, batch and spec changes.',
  35: 'Adds prep notes, house-made recipes, cost and editing.',
  40: 'Everything, including publishing.',
};

/** Every section of a venue drink and the role it opens at by default. */
export const DRINK_SECTIONS: readonly { name: string; opensAt: number }[] = [
  { name: 'Name, credit, description, score', opensAt: 10 },
  { name: 'Backstory, riffs, flavor', opensAt: 10 },
  { name: 'Rank it, I made it, To make', opensAt: 10 },
  { name: 'For the floor: talking points', opensAt: 20 },
  { name: 'Allergens', opensAt: 20 },
  { name: 'Service: garnish, hand-off, photos', opensAt: 20 },
  { name: 'Where it lives', opensAt: 20 },
  { name: 'Spec: names and amounts', opensAt: 30 },
  { name: 'Method', opensAt: 30 },
  { name: 'Batch sheet', opensAt: 30 },
  { name: 'Service: batch and station split', opensAt: 30 },
  { name: 'Spec changes and team notes', opensAt: 30 },
  { name: 'Add service photos', opensAt: 30 },
  { name: 'Prep notes, house-made recipes', opensAt: 35 },
  { name: 'Edit the drink', opensAt: 35 },
  { name: 'Cost and margin', opensAt: 35 },
  { name: 'Publishing, View as', opensAt: 40 },
];

/** The roles someone can look at a drink as: theirs and every one below it. */
export function viewAsChoices(realRole: number): { level: number; label: string; adds: string }[] {
  return ROLE_LEVELS.filter((r) => r.level <= realRole).map((r) => ({ level: r.level, label: r.label, adds: ROLE_ADDS[r.level] ?? '' }));
}

/** A cell in the role matrix: open, open for the first time at this role, or locked. */
export function lensCell(opensAt: number, level: number): 'first' | 'open' | 'lock' {
  if (level < opensAt) return 'lock';
  return level === opensAt && opensAt > 10 ? 'first' : 'open';
}
