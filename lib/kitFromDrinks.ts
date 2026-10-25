// What next › From your drinks (Kit and ice, step 12): what a venue's drinks
// name that isn't in its Kit yet. Glasses by the shape they're drawn as,
// ice by its drawing kind, tools from blended drinks and the venue's own ice
// recipes' steps.

import { iceKind } from './iceBuild';
import { draftSketchInputs } from './sketch/draft';
import type { SketchGlass } from './sketch/types';
import { equipmentById } from './techniques/equipment';
import { iceDrawKind, inTheGlass, type IceKind } from './venueKit';

export interface DrinkKit {
  glass: string | null;
  ice: string | null;
  methods: readonly string[];
}

export interface KitHave {
  glasses: readonly { id: string; glass: SketchGlass; name: string | null; model_id: string | null }[];
  ice: readonly { name: string; shape: string; draw_as: string | null }[];
  /** Ours by equipment id. */
  tools: readonly string[];
  /** The venue's ice it makes, with the tools its steps name. */
  iceSteps: readonly { ice: string; equipment: readonly string[] }[];
}

export interface FromDrinks {
  /** "Small Rocks · 2 drinks": not in the Kit (add), or in it with no real glass (match, by its id). */
  glasses: { name: string; glass: SketchGlass; drinks: number; match: string | null }[];
  ice: { name: string; kind: IceKind; drinks: number }[];
  /** "Blender · 2 drinks are blended", "Ice stamp · your Clear cube recipe uses it". */
  tools: { key: string; why: string }[];
}

const glassOf = (name: string) => draftSketchInputs({ name: '', lines: [], glass: name }).glass;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What the venue's drinks name that its Kit doesn't have, most-named first. */
export function kitFromDrinks(drinks: readonly DrinkKit[], have: KitHave): FromDrinks {
  const count = (names: (string | null)[]) => {
    const by = new Map<string, number>();
    for (const n of names) if (n?.trim()) by.set(n.trim(), (by.get(n.trim()) ?? 0) + 1);
    return [...by].sort((a, b) => b[1] - a[1]);
  };

  const glasses: FromDrinks['glasses'] = [];
  for (const [name, n] of count(drinks.map((d) => d.glass))) {
    const glass = glassOf(name);
    const mine = have.glasses.filter((g) => g.glass === glass);
    if (!mine.length) glasses.push({ name, glass, drinks: n, match: null });
    else if (mine.every((g) => !g.model_id) && !glasses.some((g) => g.match === mine[0].id)) glasses.push({ name, glass, drinks: n, match: mine[0].id });
  }

  const kinds = new Set(have.ice.filter(inTheGlass).map((i) => iceDrawKind(i)));
  const ice: FromDrinks['ice'] = [];
  for (const [name, n] of count(drinks.map((d) => d.ice))) {
    const kind = iceKind(name);
    if (!kind || kind === 'none' || kinds.has(kind) || ice.some((i) => i.kind === kind)) continue;
    ice.push({ name, kind, drinks: n });
  }

  const tools: FromDrinks['tools'] = [];
  const blended = drinks.filter((d) => d.methods.some((m) => /blend/i.test(m))).length;
  if (blended && !have.tools.includes('blender')) tools.push({ key: 'blender', why: `${plural(blended, 'drink is', 'drinks are')} blended` });
  for (const s of have.iceSteps) {
    for (const key of s.equipment) {
      if (!equipmentById(key) || have.tools.includes(key) || tools.some((t) => t.key === key)) continue;
      tools.push({ key, why: `Your ${s.ice} recipe uses it` });
    }
  }
  return { glasses, ice, tools };
}
