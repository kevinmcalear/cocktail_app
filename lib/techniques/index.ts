/**
 * The technique library: how to make anything behind the bar, with the
 * equipment each way needs. Built-in data, not a table.
 *
 * ponytail: shipped with the app, so a new technique is an app update and
 * venues can't write their own yet. Upgrade path: a `techniques` table
 * seeded from this data, once venues need house techniques.
 */
import type { IconName } from '@/components/ds';

import { CLARIFY, WASH } from './data/clarify';
import { FOAM } from './data/foam';
import { INFUSE } from './data/infuse';
import { CARBONATE, COLD, DISTIL, PRESERVE } from './data/more';
import { SYRUP } from './data/syrup';
import { TEXTURE } from './data/texture';
import { equipmentById } from './equipment';
import type { Part, Technique, TechniqueGroup } from './types';

export type { Equipment, EquipmentKind, Grade, Part, Source, Step, Technique, TechniqueGroup } from './types';
export { EQUIPMENT, EQUIPMENT_KINDS, equipmentById, TIER_LABEL } from './equipment';
export { technicalIngredientFor, TECHNICAL_INGREDIENTS, type TechnicalIngredient } from './ingredients';

export const GROUPS: { id: TechniqueGroup; name: string; blurb: string; icon: IconName }[] = [
  { id: 'foam', name: 'Foams and airs', blurb: 'Shaken heads, siphon foams, airs', icon: 'sparkles' },
  { id: 'clarify', name: 'Clarify', blurb: 'Agar, gelatin, centrifuge', icon: 'drop.fill' },
  { id: 'wash', name: 'Wash', blurb: 'Milk punch, fat washing', icon: 'mug.fill' },
  { id: 'infuse', name: 'Infuse', blurb: 'Nitrous, sous vide, cold, tinctures', icon: 'leaf.fill' },
  { id: 'syrup', name: 'Syrups, cordials and acids', blurb: 'By weight, oleo, acid adjusting, saline', icon: 'flask' },
  { id: 'texture', name: 'Texture and body', blurb: 'Body, suspension, spheres, powders', icon: 'circle.lefthalf.filled' },
  { id: 'carbonate', name: 'Carbonate', blurb: 'CO2 rig and siphon', icon: 'arrow.up' },
  { id: 'cold', name: 'Cold, ice and batching', blurb: 'Clear ice, freezer batches, frozen drinks', icon: 'snowflake' },
  { id: 'preserve', name: 'Ferment, pickle and dry', blurb: 'Ferments, pickles, dried garnish, smoke', icon: 'sun.max.fill' },
  { id: 'distil', name: 'Distil', blurb: 'Rotary evaporation', icon: 'hammer.fill' },
];

export const TECHNIQUES: Technique[] = [...FOAM, ...CLARIFY, ...WASH, ...INFUSE, ...SYRUP, ...TEXTURE, ...CARBONATE, ...COLD, ...PRESERVE, ...DISTIL];

const BY_ID = new Map(TECHNIQUES.map((t) => [t.id, t]));

export function techniqueById(id: string | null | undefined): Technique | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function groupById(id: string | null | undefined) {
  return GROUPS.find((g) => g.id === id);
}

/** A prep card's action tag ("Clarify", "Fat wash") to the group that teaches it. */
const ACTION_GROUP: Record<string, TechniqueGroup> = {
  Blend: 'syrup', Infuse: 'infuse', Clarify: 'clarify', Syrup: 'syrup', 'Sous vide': 'infuse', Centrifuge: 'clarify',
  Distil: 'distil', Ferment: 'preserve', Freeze: 'cold', Carbonate: 'carbonate', 'Fat wash': 'wash', 'Milk wash': 'wash',
  Dehydrate: 'preserve', Foam: 'foam',
};

export function groupForAction(action: string): TechniqueGroup | undefined {
  return ACTION_GROUP[action];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Techniques whose name, other names or summary hold every word typed. */
export function searchTechniques(query: string, list: readonly Technique[] = TECHNIQUES): Technique[] {
  const words = norm(query).split(' ').filter(Boolean);
  if (!words.length) return [...list];
  return list.filter((t) => {
    const hay = norm([t.name, ...(t.also ?? []), t.summary].join(' '));
    return words.every((w) => hay.includes(w));
  });
}

/** Every piece it can't be done without is in the kit. */
export function canMake(t: Technique, kit: ReadonlySet<string>): boolean {
  return t.equipment.every((id) => kit.has(id));
}

/** The equipment a technique needs that the kit doesn't have. */
export function missingKit(t: Technique, kit: ReadonlySet<string>): string[] {
  return t.equipment.filter((id) => !kit.has(id)).map((id) => equipmentById(id)?.name ?? id);
}

/** Techniques that need or use a piece of equipment. */
export function techniquesUsing(equipmentId: string): { needs: Technique[]; helps: Technique[] } {
  return {
    needs: TECHNIQUES.filter((t) => t.equipment.includes(equipmentId)),
    helps: TECHNIQUES.filter((t) => t.helpful?.includes(equipmentId)),
  };
}

/** How many techniques owning this piece would open up, given the rest of the kit. */
export function unlocks(equipmentId: string, kit: ReadonlySet<string>): number {
  const withIt = new Set(kit).add(equipmentId);
  return TECHNIQUES.filter((t) => t.equipment.includes(equipmentId) && canMake(t, withIt)).length;
}

/** The parts for an amount of base: 400 g juice → 133 g water, 1.07 g agar. */
export function scaleParts(parts: readonly Part[], base: number): { name: string; amount: number; unit: Part['unit'] }[] {
  if (!(base > 0)) return [];
  return parts.map((p) => ({ name: p.name, amount: p.per * base, unit: p.unit }));
}

/** Small doses keep their decimals: 1.07 g, 0.27 g, 133 g. */
export function formatDose(n: number): string {
  if (n >= 100) return String(Math.round(n));
  if (n >= 10) return String(Math.round(n * 10) / 10);
  if (n >= 0.01) return String(Math.round(n * 100) / 100);
  return n > 0 ? '<0.01' : '0';
}

