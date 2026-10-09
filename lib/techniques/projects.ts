// My Bar's Projects: the techniques your kit and lab shelf allow, and the
// ones a single missing piece stands in front of. Kit is equipment ids
// (hooks/useKit); the lab is technical ingredient ids, matched from the
// names on your shelf.

import { equipmentById } from './equipment';
import { TECHNIQUES } from './index';
import { technicalIngredientFor, TECHNICAL_INGREDIENTS } from './ingredients';
import type { Technique } from './types';

export interface Project {
  technique: Technique;
  /** Names of the kit and lab ingredients it uses that you have. */
  uses: string[];
}

/** One missing piece of kit or lab ingredient, and the techniques it alone stands in front of. */
export interface AwayProject {
  missing: { kind: 'kit' | 'lab'; id: string; name: string };
  techniques: Technique[];
}

/** The technical ingredients a technique's parts call for, by id ("Gelatin (170 bloom)" counts as gelatin). */
export function labNeeds(t: Technique): string[] {
  const ids = (t.parts ?? []).flatMap((p) => technicalIngredientFor(p.name.replace(/\s*\(.*\)\s*$/, ''))?.id ?? []);
  return [...new Set(ids)];
}

/** Technical ingredient ids among the names on your shelf. */
export function labFromNames(names: readonly string[]): Set<string> {
  return new Set(names.flatMap((n) => technicalIngredientFor(n)?.id ?? []));
}

const labName = (id: string) => TECHNICAL_INGREDIENTS.find((i) => i.id === id)?.name ?? id;

/**
 * What you can make, most involved first (the ones that use what you've
 * collected), then what one more piece of kit or one lab ingredient opens,
 * the piece that opens most first.
 * Techniques behind a safety or legal gate (liquid nitrogen, distilling) are
 * never suggested.
 */
export function projectsFor(kit: ReadonlySet<string>, lab: ReadonlySet<string>, list: readonly Technique[] = TECHNIQUES): { ready: Project[]; away: AwayProject[] } {
  const ready: Project[] = [];
  const away = new Map<string, AwayProject>();
  for (const t of list) {
    if (t.gate) continue;
    const needs = labNeeds(t);
    const missing = [
      ...t.equipment.filter((id) => !kit.has(id)).map((id) => ({ kind: 'kit' as const, id, name: equipmentById(id)?.name ?? id })),
      ...needs.filter((id) => !lab.has(id)).map((id) => ({ kind: 'lab' as const, id, name: labName(id) })),
    ];
    if (!missing.length) ready.push({ technique: t, uses: [...t.equipment.map((id) => equipmentById(id)?.name ?? id), ...needs.map(labName)] });
    else if (missing.length === 1) {
      const key = `${missing[0].kind}:${missing[0].id}`;
      const group = away.get(key) ?? { missing: missing[0], techniques: [] };
      group.techniques.push(t);
      away.set(key, group);
    }
  }
  ready.sort((a, b) => b.uses.length - a.uses.length);
  return { ready, away: [...away.values()].sort((a, b) => b.techniques.length - a.techniques.length) };
}
