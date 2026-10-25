// The kit check (Kit and ice, step 11): can this venue make a drink with what
// it has? A drink needs its glass, its ice (each layer, and what it's shaken
// with) and the tools its method names; an ice the venue makes needs the tools
// its recipe names, followed back through what it starts from. A part of the
// Kit with nothing listed isn't checked, so an empty Kit doesn't mark every
// drink as missing something.

import { iceKind } from './iceBuild';
import { glassOf } from './kitFromDrinks';
import { andList } from './makers';
import type { SketchGlass } from './sketch/types';
import { equipmentById } from './techniques/equipment';
import { GLASS_TYPE_LABEL } from './glassware';
import { houseIce, iceDrawKind, inTheGlass, venueIceKinds, type IceKind } from './venueKit';

/** The tools a method names, ours by id ("Shake" is tins and a strainer). */
const METHOD_TOOLS: Record<string, readonly string[]> = {
  shake: ['shaker', 'strainers'],
  'dry shake': ['shaker'],
  'whip shake': ['shaker'],
  throw: ['shaker', 'strainers'],
  roll: ['shaker'],
  stir: ['mixing-glass', 'strainers'],
  blend: ['blender'],
};

/** The tools a drink's methods name, each once. */
export function methodTools(methods: readonly string[]): string[] {
  return [...new Set(methods.flatMap((m) => METHOD_TOOLS[m.trim().toLowerCase()] ?? []))];
}

export interface CheckDrink {
  glass: string | null;
  /** Every ice it needs: the build's layers and what it's shaken or stirred with. */
  ice: readonly string[];
  methods: readonly string[];
}

export interface CheckKit {
  glasses: readonly { id: string; glass: SketchGlass; name: string | null; model_id: string | null }[];
  ice: readonly { id: string; name: string; shape: string; draw_as: string | null; source: string | null }[];
  /** Ours by id. */
  tools: readonly string[];
  /** An ice made here: the tools its steps name, and the ice it starts from. */
  recipes: ReadonlyMap<string, { tools: readonly string[]; from: string | null }>;
}

export interface IceCheck {
  name: string;
  kind: IceKind;
  ok: boolean;
  /** The venue's ice it's poured as. */
  yours: string | null;
  /** None of that kind: the nearest the venue has. */
  nearest: string | null;
  /** Tools the venue's recipe for it needs and doesn't have. */
  missing: string[];
}

export interface KitCheck {
  glass: { name: string; glass: SketchGlass; ok: boolean; yours: string | null } | null;
  ice: IceCheck[];
  tools: { needed: string[]; missing: string[] } | null;
  ready: boolean;
  /** "Needs a sphere", "Needs shaved ice and a block ice shaver"; null when ready. */
  needs: string | null;
}

const ICE_WORDS: Record<IceKind, string> = {
  cubes: 'cubes',
  large: 'a large cube',
  spear: 'a Collins block',
  sphere: 'a sphere',
  crushed: 'crushed ice',
  pebble: 'pebble ice',
  shaved: 'shaved ice',
};
/** A glass in a sentence: "coupe", "Nick & Nora". */
export const glassNoun = (g: SketchGlass) => (g === 'nick' ? GLASS_TYPE_LABEL.nick : GLASS_TYPE_LABEL[g].toLowerCase());
const glassWord = (g: SketchGlass) => `a ${glassNoun(g)}`;
const toolWord = (id: string) => {
  const name = (equipmentById(id)?.name ?? id).toLowerCase();
  // "shaker tins", "hawthorne and julep strainers" are plural by their last word; "a mixing glass and bar spoon".
  const last = name.replace(/\s*\(.*\)$/, '').split(' ').pop() ?? '';
  return /[^s]s$/.test(last) ? name : `${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name}`;
};

/** The tools an ice made here needs and the venue lacks, following what it starts from (each ice once). */
function recipeMissing(id: string, kit: CheckKit): string[] {
  const seen = new Set<string>();
  const missing: string[] = [];
  for (let at: string | null = id; at && !seen.has(at); at = kit.recipes.get(at)?.from ?? null) {
    seen.add(at);
    for (const t of kit.recipes.get(at)?.tools ?? []) if (equipmentById(t) && !kit.tools.includes(t) && !missing.includes(t)) missing.push(t);
  }
  return missing;
}

/** Can the venue make it: each part, and what it needs. */
export function kitCheck(drink: CheckDrink, kit: CheckKit): KitCheck {
  const shape = drink.glass ? glassOf(drink.glass) : null;
  const mine = shape ? kit.glasses.find((g) => g.glass === shape) : undefined;
  const glass = shape && kit.glasses.length ? { name: drink.glass!, glass: shape, ok: !!mine, yours: mine ? (mine.name ?? GLASS_TYPE_LABEL[mine.glass]) : null } : null;

  const kinds = venueIceKinds(kit.ice);
  const ice: IceCheck[] = [];
  for (const name of drink.ice) {
    const kind = iceKind(name);
    if (!kind || kind === 'none' || !kit.ice.length || ice.some((i) => i.kind === kind)) continue;
    const row = kit.ice.find((r) => inTheGlass(r) && iceDrawKind(r) === kind);
    const near = row ? null : houseIce(kind, kinds);
    ice.push({
      name,
      kind,
      ok: !!row,
      yours: row?.name ?? null,
      nearest: near ? (kit.ice.find((r) => inTheGlass(r) && iceDrawKind(r) === near)?.name ?? null) : null,
      // Tools with nothing listed aren't checked, an ice's recipe tools included.
      missing: row?.source === 'made' && kit.tools.length ? recipeMissing(row.id, kit) : [],
    });
  }

  const needed = methodTools(drink.methods);
  const tools = needed.length && kit.tools.length ? { needed, missing: needed.filter((t) => !kit.tools.includes(t)) } : null;

  const words = [
    ...(glass && !glass.ok ? [glassWord(glass.glass)] : []),
    ...ice.filter((i) => !i.ok).map((i) => ICE_WORDS[i.kind]),
    ...[...ice.flatMap((i) => i.missing), ...(tools?.missing ?? [])].filter((t, n, all) => all.indexOf(t) === n).map(toolWord),
  ];
  return { glass, ice, tools, ready: !words.length, needs: words.length ? `Needs ${andList(words)}` : null };
}
