import { equipmentById } from './equipment';
import type { Technique } from './types';

/**
 * Kit first (make-anything-steps-1, step 4, more to it): what the kit covers,
 * then the rest, each in the order given. Nothing is dropped. Null is a kit
 * still loading: everything counts as covered until it's known.
 */
export function byKit<T extends Pick<Technique, 'equipment'>>(list: readonly T[], kit: ReadonlySet<string> | null): { have: T[]; need: T[] } {
  // A kit still loading dims nothing.
  if (!kit) return { have: [...list], need: [] };
  const covered = (t: T) => t.equipment.every((id) => kit.has(id));
  return { have: list.filter(covered), need: list.filter((t) => !covered(t)) };
}

/** "Needs a chamber vacuum sealer", "Needs dasher and dropper bottles and a microwave": what's missing, as the board says it. */
export function needsText(missing: readonly string[]): string {
  const said = missing.map((id) => {
    const name = (equipmentById(id)?.name ?? id).replace(/^\w/, (c) => c.toLowerCase());
    // A plural ("tins", "bottles") or a set ("... and cryo gloves") takes no article.
    if (/s$|\band\b/.test(name.replace(/\s*\(.*\)$/, ''))) return name;
    return `${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name}`;
  });
  return `Needs ${said.join(' and ')}`;
}
