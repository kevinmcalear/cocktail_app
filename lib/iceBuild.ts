/**
 * How the ice sits in the glass (items.ice_build, supabase/migrations/
 * 20261029500000_ice_builds.sql; canvas "Ice builds", approved by Kevin
 * 20 Oct 2026): layers from the bottom up, each an ice with how many pieces
 * or how high it goes. Cubes under pebble so it looks full of pebble, a spear
 * on a cube when the glass is taller than the spear, crushed mounded over the
 * rim, the shaking ice dumped in. A drink with one plain ice has no build;
 * items.ice_id stays the top layer, so everything that reads one ice still does.
 *
 * ponytail: public pages, published snapshots and the run sheet read their own
 * SQL and still show only the top ice; give them ice_build when a guest asks.
 */
import { itemIce, type Kinded } from '@/supabase/functions/_shared/sketchRules';

/** How high a loose layer (crushed, pebble, shaved) goes. */
export const ICE_TO = ['half', 'rim', 'mound'] as const;
export type IceTo = (typeof ICE_TO)[number];
export const ICE_TO_LABEL: Record<IceTo, string> = { half: 'Half', rim: 'To the top', mound: 'Mounded' };

/**
 * One layer, bottom first. `ice` is an ice item's id when stored, a wizard pick while drafting.
 * A type, not an interface, so a build passes as Json (items.ice_build).
 */
export type IceLayer<T = string> = {
  ice: T;
  /** Pieces (cubes, a spear): how many. */
  n?: number | null;
  /** Loose ice: how high. */
  to?: IceTo | null;
  packed?: boolean;
  /** The shaking ice, dumped in with the drink. */
  tin?: boolean;
};

/** An ice by name, or its item or pick: the kind it stores (items.ice_kind, a pick's `kind`) beats its name. */
export type IceName = string | { name: string; kind?: string | null; ice_kind?: string | null };
/** An ice's name, however it's given. */
export const iceNameOf = (ice: IceName) => (typeof ice === 'string' ? ice : ice.name);

/** As the drawings name it ('cubes', 'pebble'): the item's kind when it says, else read from its name. */
export const iceKind = (ice: Kinded) => itemIce(ice);
const LOOSE = ['crushed', 'pebble', 'shaved'];
/** Crushed, pebble, shaved: poured to a height, not counted. */
export const isLoose = (ice: Kinded) => LOOSE.includes(iceKind(ice) ?? '');
/** One big piece other ice packs around: a large cube, a sphere. */
const isBlock = (ice: IceName) => ['large', 'sphere'].includes(iceKind(ice) ?? '');

export const MAX_LAYERS = 6;
export const MAX_PIECES = 12;

/** Whether a build says more than its one ice does, so it's worth saving. */
export const saysMore = <T>(layers: readonly IceLayer<T>[] | null | undefined): layers is IceLayer<T>[] =>
  !!layers?.length && (layers.length > 1 || layers.some((l) => (l.n ?? 1) > 1 || !!l.to || !!l.packed || !!l.tin));

// --- the spec line ---

/** "cubes" to "cube", for one piece and for counting words. */
export const singular = (name: string) => {
  const n = name.trim().toLowerCase();
  return /[^s]s$/.test(n) ? n.slice(0, -1) : n;
};
const plural = (name: string) => {
  const n = singular(name);
  return n.endsWith('s') ? n : `${n}s`;
};

const lower = (ice: IceName) => iceNameOf(ice).trim().toLowerCase();

function phrase(l: IceLayer<IceName>): string {
  if (l.tin) return 'the shaking ice';
  if (isLoose(l.ice)) return `${l.packed ? 'packed ' : ''}${lower(l.ice)}${l.to === 'half' ? ' to half' : ''}`;
  const n = l.n ?? 1;
  return n > 1 ? `${n} ${plural(iceNameOf(l.ice))}` : `a ${singular(iceNameOf(l.ice))}`;
}

/**
 * The drink page's Ice for a build, bottom to top: "Over 4 cubes, pebble on
 * top, mounded"; "Over a large cube, packed crushed around it"; "The shaking
 * ice, dumped in, crushed on top, mounded". `ice` is each layer's name, or its item.
 */
export function iceBuildLine(layers: readonly IceLayer<IceName>[]): string {
  const parts = layers.map((l, i) => {
    const mound = l.to === 'mound' ? ', mounded' : '';
    if (i === 0) return (l.tin ? 'The shaking ice, dumped in' : `Over ${phrase(l)}`) + mound;
    const prev = layers[i - 1];
    if (isLoose(l.ice) && !prev.tin && isBlock(prev.ice) && (prev.n ?? 1) === 1) return `${phrase(l)} around it${mound}`;
    if (isLoose(l.ice) && iceKind(prev.ice) === iceKind(l.ice)) return `topped with more ${lower(l.ice)}${mound}`;
    return `${phrase(l)} on top${mound}`;
  });
  return parts.join(', ');
}

// --- quick builds ---

export const QUICK_BUILDS = ['cubes-pebble', 'spear-cubes', 'crushed-mound', 'dump', 'collar'] as const;
export type QuickBuild = (typeof QUICK_BUILDS)[number];
export const QUICK_LABEL: Record<QuickBuild, string> = {
  'cubes-pebble': 'Cubes, pebble on top',
  'spear-cubes': 'Spear on cubes',
  'crushed-mound': 'Crushed, mounded',
  dump: 'Dump the tin',
  collar: 'Large cube, crushed around',
};

/**
 * A quick build's layers. `pick` turns an ice's name into the drink's own
 * choice for it (the venue's, or one to make on save); `madeWith` is the ice
 * it's shaken with, for Dump the tin.
 */
export function quickBuild<T>(q: QuickBuild, pick: (name: string) => T, madeWith?: T | null): IceLayer<T>[] {
  switch (q) {
    case 'cubes-pebble':
      return [{ ice: pick('Cubes'), n: 4 }, { ice: pick('Pebble'), to: 'mound' }];
    case 'spear-cubes':
      return [{ ice: pick('Cubes'), n: 2 }, { ice: pick('Spear'), n: 1 }];
    case 'crushed-mound':
      return [{ ice: pick('Crushed'), to: 'mound', packed: true }];
    case 'dump':
      return [{ ice: madeWith ?? pick('Cubes'), tin: true }, { ice: pick('Crushed'), to: 'mound' }];
    case 'collar':
      return [{ ice: pick('Large cube'), n: 1 }, { ice: pick('Crushed'), to: 'rim', packed: true }];
  }
}

/** Which quick build these layers are, by shape (kinds, counts, heights), or null. */
export function whichQuick(layers: readonly IceLayer<IceName>[]): QuickBuild | null {
  const shape = (ls: readonly IceLayer<IceName>[]) => JSON.stringify(ls.map((l) => [l.tin ? 'tin' : iceKind(l.ice), l.tin ? 0 : l.n ?? 1, l.to ?? null, !!l.packed]));
  const mine = shape(layers);
  return QUICK_BUILDS.find((q) => shape(quickBuild(q, (n) => n, 'Cubes')) === mine) ?? null;
}

// --- suggestions ---

/** A standard collins spear (Abstract Ice "Tower", 5.25 in) when the venue's Kit doesn't say. */
export const STANDARD_SPEAR_MM = 133;
/** A bar cube, for how many fill the gap under a spear (Kold-Draft, 1.25 in). */
const CUBE_MM = 32;
const TALL = ['highball', 'collins', 'tiki', 'beer'];

export interface IceTip<T extends IceName = IceName> {
  id: 'spear' | 'pebble' | 'swizzle' | 'julep' | 'dump';
  title: string;
  body: string;
  /** The button: "Put 2 cubes under it". Its layers keep the drink's own ice, and name any other ("Cubes"). */
  yes: string;
  layers: IceLayer<T | string>[];
}

export interface TipFacts<T extends IceName = IceName> {
  /** The layers as they are, by ice name or item. */
  layers: readonly IceLayer<T>[];
  /** The drawing's glass ('collins'), the glass's own name and its height when the venue's glass says. */
  glass: string | null;
  glassName?: string | null;
  glassHeightMm?: number | null;
  /** The venue's spear (item_ice.length_mm). */
  spearMm?: number | null;
  methods: readonly string[];
  /** The ice it's made with, by name or item. */
  madeWith?: T | null;
  /** Tips the maker said No thanks to, for this drink. */
  off?: readonly string[];
}

/**
 * The one suggestion worth making for how the ice sits, or null: plain words
 * the bartender can take or leave. Never for a drink served up.
 */
export function iceTip<T extends IceName>(f: TipFacts<T>): IceTip<T> | null {
  const tips = allTips(f).filter((t) => !f.off?.includes(t.id));
  return tips[0] ?? null;
}

function allTips<T extends IceName>(f: TipFacts<T>): IceTip<T>[] {
  const out: IceTip<T>[] = [];
  const [only] = f.layers.length === 1 ? f.layers : [];
  const kind = only ? iceKind(only.ice) : null;
  const methods = f.methods.join(' ').toLowerCase();

  // A spear shorter than the glass sits low: cubes under it bring it up.
  if (kind === 'spear' && f.glassHeightMm) {
    const spear = f.spearMm ?? STANDARD_SPEAR_MM;
    const gap = f.glassHeightMm - spear;
    if (gap >= 15) {
      const n = Math.min(3, Math.max(1, Math.round(gap / CUBE_MM)));
      const cubes = n === 1 ? 'a cube' : `${n} cubes`;
      out.push({
        id: 'spear',
        title: 'Your spear is shorter than this glass',
        body: `The spear is ${spear} mm and ${f.glassName?.trim() || 'the glass'} is ${Math.round(f.glassHeightMm)} mm tall. ${n === 1 ? 'A cube under it brings' : `${n} cubes under it bring`} it up to the rim.`,
        yes: `Put ${cubes} under it`,
        layers: [{ ice: 'Cubes', n }, { ice: only.ice, n: 1 }],
      });
    }
  }
  const loose = only && isLoose(only.ice) && !only.tin;
  // Swizzled over crushed: top it up and mound it (Queen's Park, Red Swizzle).
  if (loose && kind !== 'pebble' && /swizzl/.test(methods) && only.to !== 'mound') {
    out.push({ id: 'swizzle', title: 'Top it with more crushed?', body: 'Swizzle over crushed, then top with fresh crushed and mound it over the rim.', yes: 'Top it up', layers: [{ ice: only.ice, to: 'rim', packed: only.packed }, { ice: only.ice, to: 'mound' }] });
  }
  // A julep is filled up and over the rim.
  if (loose && f.glass === 'julep' && only.to !== 'mound') {
    out.push({ id: 'julep', title: `Mound the ${lower(only.ice)}?`, body: 'A julep cup is packed with crushed ice, up and over the rim.', yes: 'Mound it', layers: [{ ice: only.ice, to: 'mound', packed: true }] });
  }
  // Shaken with crushed and served over it: pour it all in, then top it.
  if (loose && f.madeWith && isLoose(f.madeWith) && /shak/.test(methods)) {
    out.push({ id: 'dump', title: 'Dump the tin?', body: 'Pour it all in, shaking ice too, then top with fresh crushed and mound it.', yes: 'Dump the tin', layers: [{ ice: f.madeWith, tin: true }, { ice: only.ice, to: 'mound' }] });
  }
  // Only pebble or crushed in a tall glass: cubes at the bottom look the same and save the pebble.
  if (loose && TALL.includes(f.glass ?? '')) {
    out.push({
      id: 'pebble',
      title: `Cubes under the ${lower(only.ice)}?`,
      body: `Cubes at the bottom and ${lower(only.ice)} on top looks the same in a tall glass, uses less ${lower(only.ice)} and melts slower.`,
      yes: 'Put cubes under it',
      layers: [{ ice: 'Cubes', n: 4 }, { ice: only.ice, to: only.to ?? 'mound', packed: only.packed }],
    });
  }
  return out;
}

// --- stored rows ---

/**
 * A stored build (items.ice_build) as plain layers, dropping anything this app
 * can't read. Null when there's none.
 */
export function readIceBuild(raw: unknown): IceLayer<string>[] | null {
  if (!Array.isArray(raw)) return null;
  const out: IceLayer<string>[] = [];
  for (const x of raw.slice(0, MAX_LAYERS)) {
    if (!x || typeof x !== 'object' || typeof (x as IceLayer).ice !== 'string') continue;
    const l = x as IceLayer<string>;
    out.push({
      ice: l.ice,
      ...(Number.isInteger(l.n) && l.n! >= 1 && l.n! <= MAX_PIECES ? { n: l.n } : {}),
      ...(l.to && (ICE_TO as readonly string[]).includes(l.to) ? { to: l.to } : {}),
      ...(l.packed === true ? { packed: true } : {}),
      ...(l.tin === true ? { tin: true } : {}),
    });
  }
  return out.length ? out : null;
}

/** Layers to store: the ice's id in place of whatever the draft held, empty fields left out. */
export function toStored<T>(layers: readonly IceLayer<T>[], idOf: (ice: T) => string): IceLayer<string>[] {
  return layers.map((l) => ({
    ice: idOf(l.ice),
    ...(l.n ? { n: l.n } : {}),
    ...(l.to ? { to: l.to } : {}),
    ...(l.packed ? { packed: true } : {}),
    ...(l.tin ? { tin: true } : {}),
  }));
}
