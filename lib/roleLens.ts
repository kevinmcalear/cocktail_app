// What each role opens on a venue drink (boards drink-role-lens and the
// drink page More menu's View as). Default levels: a venue can move specs to
// another role (bars.measurement_level), and its own roles can grant or
// revoke the overridable parts, so Who sees what reads the venue's role
// matrix and the drink page itself always asks the server.

import { cell, type Cell, type MatrixColumn } from './roleMatrix';
import { ROLE_LEVELS } from './roles';

/** One line per role for View as: what it adds over the one below. */
export const ROLE_ADDS: Record<number, string> = {
  10: 'The menu description, flavor and backstory. Everything else stays collapsed.',
  20: 'Adds talking points, allergens, service and where it lives.',
  30: 'Adds the spec, method, batch and spec changes.',
  35: 'Adds prep notes, house-made recipes, cost and editing.',
  40: 'Everything, including publishing.',
};

/**
 * One section of a venue drink: the role it opens at by default and, where
 * one decides it, the venue capability (lib/roleMatrix.ts) that opens it at
 * this venue. `levelBound`: set by the base level, not by a role's overrides.
 */
export interface LensRow {
  id: string;
  label: string;
  detail?: string;
  opensAt: number;
  capability?: string;
  levelBound?: boolean;
}

/** Every section of a venue drink, in the drink page's order, grouped (board drink-role-lens). */
export const LENS_GROUPS: { title: string; rows: LensRow[] }[] = [
  {
    title: 'The drink',
    rows: [
      { id: 'about', label: 'Name, credit, description, score', opensAt: 10, capability: 'menu', levelBound: true },
      { id: 'backstory', label: 'Backstory, riffs, flavor', opensAt: 10, levelBound: true },
      { id: 'journey', label: 'Rank it, I made it, To make', opensAt: 10, levelBound: true },
    ],
  },
  {
    title: 'For the floor',
    rows: [
      { id: 'talking', label: 'Talking points and allergens', opensAt: 20, capability: 'talking_points' },
      { id: 'service', label: 'Service: garnish, hand-off, photos', opensAt: 20, levelBound: true },
      { id: 'where', label: 'Where it lives', detail: 'The back bar map', opensAt: 20, capability: 'locations' },
    ],
  },
  {
    title: 'Making it',
    rows: [
      { id: 'spec', label: 'Spec: names and amounts', opensAt: 30, capability: 'specs', levelBound: true },
      { id: 'method', label: 'Method', opensAt: 30, capability: 'specs', levelBound: true },
      { id: 'batch', label: 'Batch sheet and station split', detail: 'Needs the amounts, so it follows the spec', opensAt: 30, capability: 'specs', levelBound: true },
      { id: 'changes', label: 'Spec changes and team notes', opensAt: 30, capability: 'specs', levelBound: true },
      { id: 'photos', label: 'Add service photos', opensAt: 30, capability: 'photos' },
    ],
  },
  {
    title: 'Behind the bar',
    rows: [
      { id: 'house', label: 'Prep notes, house-made recipes', opensAt: 35, capability: 'house_made' },
      { id: 'edit', label: 'Edit the drink', opensAt: 35, capability: 'edit_drinks', levelBound: true },
      { id: 'costs', label: 'Cost and margin', opensAt: 35, capability: 'costs' },
    ],
  },
  {
    title: 'Running the venue',
    rows: [{ id: 'publish', label: 'Publishing, View as', opensAt: 40, capability: 'publish' }],
  },
];

/**
 * Whether a column (a base level or one of the venue's roles) opens a section:
 * the venue's own answer where a capability decides it (so a venue that moved
 * specs, or a role that grants or takes one away, shows here), else the
 * section's default level.
 */
export function lensValue(matrix: MatrixColumn[], column: MatrixColumn, row: LensRow): Cell {
  if (row.capability) return cell(matrix, column, row.capability);
  return { can: column.base_level >= row.opensAt, changed: false };
}

/** The base levels alone, opening sections at their default levels: before the venue's matrix loads, or without one. */
export function defaultColumns(): MatrixColumn[] {
  const rows = LENS_GROUPS.flatMap((g) => g.rows);
  return ROLE_LEVELS.map((r) => ({
    role_id: null,
    name: null,
    base_level: r.level,
    ends_at: null,
    granted: [],
    revoked: [],
    capabilities: [...new Set(rows.filter((x) => x.capability && r.level >= x.opensAt).map((x) => x.capability!))],
  }));
}

/** The roles someone can look at a drink as: theirs and every one below it. */
export function viewAsChoices(realRole: number): { level: number; label: string; adds: string }[] {
  return ROLE_LEVELS.filter((r) => r.level <= realRole).map((r) => ({ level: r.level, label: r.label, adds: ROLE_ADDS[r.level] ?? '' }));
}
