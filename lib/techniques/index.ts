/**
 * The technique library: how to make anything behind the bar, with the
 * equipment each way needs. Built-in data, not a table.
 *
 * The data (lib/techniques/library.ts, ~150 KB) is one lazy chunk on the web,
 * so no page's first load carries it. This file is the small part every page
 * may load: the groups, the pure helpers, and a registry that answers once
 * the data is in. A screen that reads the library renders under
 * <TechniquesGate> (components/techniques/TechniquesGate.tsx) or returns early
 * until useTechniques() is true; a save path awaits loadTechniques(). Read
 * before then, every getter answers as if the library were empty.
 *
 * ponytail: shipped with the app, so a new technique is an app update and
 * venues can't write their own yet. Upgrade path: a `techniques` table
 * seeded from this data, once venues need house techniques.
 */
import { useEffect, useSyncExternalStore } from 'react';

import type { IconName } from '@/components/ds';

import type { Equipment, EquipmentKind, Part, Technique, TechniqueGroup } from './types';

export type { BuyAudience, BuyLink, Equipment, EquipmentKind, Grade, Part, Source, Step, Technique, TechniqueGroup } from './types';

// --- the registry ---

type Library = { TECHNIQUES: readonly Technique[]; EQUIPMENT: readonly Equipment[] };
type Loaded = {
  techniques: readonly Technique[];
  equipment: readonly Equipment[];
  techniqueIds: ReadonlyMap<string, Technique>;
  equipmentIds: ReadonlyMap<string, Equipment>;
};

let loaded: Loaded | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** Puts the data in: loadTechniques() on the app, lib/techniques/testing.ts in checks and tests. */
export function installTechniques(lib: Library) {
  if (loaded) return;
  loaded = {
    techniques: lib.TECHNIQUES,
    equipment: lib.EQUIPMENT,
    techniqueIds: new Map(lib.TECHNIQUES.map((t) => [t.id, t])),
    equipmentIds: new Map(lib.EQUIPMENT.map((e) => [e.id, e])),
  };
  for (const l of listeners) l();
}

/** Loads the library once; a failed load (offline, an old deploy) is tried again on the next call. */
export function loadTechniques(): Promise<void> {
  if (loaded) return Promise.resolve();
  loading ??= import('./library').then(installTechniques, (e: unknown) => {
    loading = null;
    throw e;
  });
  return loading;
}

export const techniquesLoaded = () => loaded !== null;

// The static export renders without the library, and hydration must match it.
const notOnServer = () => false;

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** True once the library is in; starts the load. */
export function useTechniques(): boolean {
  const ready = useSyncExternalStore(subscribe, techniquesLoaded, notOnServer);
  useEffect(() => {
    // A failed load leaves the gate closed; the next screen that needs it tries again.
    if (!ready) loadTechniques().catch(() => {});
  }, [ready]);
  return ready;
}

/** Every technique; empty until the library is in. */
export const allTechniques = (): readonly Technique[] => loaded?.techniques ?? [];

/** Every piece of equipment; empty until the library is in. */
export const allEquipment = (): readonly Equipment[] => loaded?.equipment ?? [];

export function techniqueById(id: string | null | undefined): Technique | undefined {
  return id ? loaded?.techniqueIds.get(id) : undefined;
}

export function equipmentById(id: string): Equipment | undefined {
  return loaded?.equipmentIds.get(id);
}

// --- small, always here ---

export const GROUPS: { id: TechniqueGroup; name: string; blurb: string; icon: IconName }[] = [
  { id: 'shake', name: 'Shake and stir', blurb: 'Dilution, dry shakes, the whip', icon: 'wineglass' },
  { id: 'foam', name: 'Foam', blurb: 'Egg white, aquafaba, foamer drops', icon: 'sparkles' },
  { id: 'clarify', name: 'Clarify', blurb: 'Milk punch, agar, the centrifuge', icon: 'drop.fill' },
  { id: 'wash', name: 'Wash', blurb: 'Milk punch, fat washing', icon: 'mug.fill' },
  { id: 'infuse', name: 'Infuse and smoke', blurb: 'Sous vide, fat-wash, a smoking gun', icon: 'leaf.fill' },
  { id: 'syrup', name: 'Syrups, cordials and acids', blurb: 'By weight, oleo, super juice, falernum, nut milks', icon: 'flask' },
  { id: 'texture', name: 'Texture and body', blurb: 'Body, suspension, spheres, jellies, powders', icon: 'circle.lefthalf.filled' },
  { id: 'carbonate', name: 'Carbonate', blurb: 'CO2 rig and siphon', icon: 'arrow.up' },
  { id: 'cold', name: 'Cold, ice and batching', blurb: 'Clear ice, freezer batches, slush machines, dry ice', icon: 'snowflake' },
  { id: 'preserve', name: 'Ferment and preserve', blurb: 'Shrubs, oleo, cordials', icon: 'sun.max.fill' },
  { id: 'cook', name: 'Heat and cook', blurb: 'Microwave, pressure cooker, caramel, char, nixtamal', icon: 'thermometer.medium' },
  { id: 'garnish', name: 'Garnish', blurb: 'Candied peel, sugar glass, pâte de fruit, rims', icon: 'scissors' },
  { id: 'age', name: 'Age and wood', blurb: 'Barrels, oak, house liqueurs', icon: 'clock' },
  { id: 'distil', name: 'Distil', blurb: 'Rotary evaporation', icon: 'hammer.fill' },
];

export function groupById(id: string | null | undefined) {
  return GROUPS.find((g) => g.id === id);
}

/** A prep card's action tag ("Clarify", "Fat wash") to the group that teaches it. */
const ACTION_GROUP: Record<string, TechniqueGroup> = {
  Blend: 'syrup', Infuse: 'infuse', Clarify: 'clarify', Syrup: 'syrup', 'Sous vide': 'infuse', Centrifuge: 'clarify',
  Distil: 'distil', Ferment: 'preserve', Freeze: 'cold', Carbonate: 'carbonate', 'Fat wash': 'wash', 'Milk wash': 'wash',
  Dehydrate: 'preserve', Foam: 'foam', Smoke: 'preserve', Tincture: 'infuse', Oil: 'infuse', Age: 'age', Cook: 'cook',
};

export function groupForAction(action: string): TechniqueGroup | undefined {
  return ACTION_GROUP[action];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Techniques whose name, other names or summary hold every word typed. */
export function searchTechniques(query: string, list: readonly Technique[] = allTechniques()): Technique[] {
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
    needs: allTechniques().filter((t) => t.equipment.includes(equipmentId)),
    helps: allTechniques().filter((t) => t.helpful?.includes(equipmentId)),
  };
}

/** How many techniques owning this piece would open up, given the rest of the kit. */
export function unlocks(equipmentId: string, kit: ReadonlySet<string>): number {
  const withIt = new Set(kit).add(equipmentId);
  return allTechniques().filter((t) => t.equipment.includes(equipmentId) && canMake(t, withIt)).length;
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

export const EQUIPMENT_KINDS: { id: EquipmentKind; name: string }[] = [
  { id: 'bar', name: 'Bar tools' },
  { id: 'kitchen', name: 'Kitchen' },
  { id: 'measure', name: 'Measure' },
  { id: 'mix', name: 'Blend and whip' },
  { id: 'pressure', name: 'Gas and vacuum' },
  { id: 'temperature', name: 'Heat and cold' },
  { id: 'separate', name: 'Strain and spin' },
  { id: 'specialist', name: 'Specialist' },
];

/** A tier in words: only `price` is sourced, so tiers stay rough. */
export const TIER_LABEL: Record<Equipment['tier'], string> = { $: 'Under about $50', $$: 'About $50 to $500', $$$: 'Over about $500' };

/**
 * A search of the kit list: every word in its name, what it's for, its other
 * names or a product it names ("hydrosonic homogenizer" finds the ultrasonic
 * probe; "Klaris", "Hoshizaki"). A buy link's shop, after its last comma, is
 * left out, or "pan" would find everything Modernist Pantry sells.
 */
export function equipmentMatches(e: Equipment, search: string): boolean {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const products = (e.buy ?? []).map((b) => (b.name.includes(', ') ? b.name.slice(0, b.name.lastIndexOf(', ')) : b.name));
  const text = [e.name, e.what, ...(e.aka ?? []), ...products].join(' ').toLowerCase();
  return words.every((w) => text.includes(w));
}
