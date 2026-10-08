/**
 * The add-beer and add-wine wizard's draft and rules: one step per screen, a
 * plain-JSON draft kept on the device until it's saved, and the quick choices
 * each step offers. Screens: components/screens/addBeerWine; saving:
 * hooks/useCreateBeerWine.ts.
 */
import { DRINK_COLORS, SKETCH_VERSION } from '../supabase/functions/_shared/sketchRules';

import type { DrinkKind } from './drinkKinds';
import type { SketchInputs } from './sketch/types';

export const BEER_WINE_STEPS = ['name', 'maker', 'style', 'strength', 'glass', 'notes', 'price', 'review'] as const;
export type BeerWineStep = (typeof BEER_WINE_STEPS)[number];

/** The steps for a place: the price only means something on a venue's list. */
export const stepsFor = (atVenue: boolean): readonly BeerWineStep[] => BEER_WINE_STEPS.filter((s) => s !== 'price' || atVenue);

type Copy = { title: string; short: string; intro?: string; optional: boolean };
export const BEER_WINE_COPY: Record<DrinkKind, Record<BeerWineStep, Copy>> = {
  beer: {
    name: { title: 'What’s the beer?', short: 'Name', optional: false },
    maker: { title: 'Who brews it?', short: 'Brewery', optional: true },
    style: { title: 'What style?', short: 'Style', optional: true },
    strength: { title: 'How strong?', short: 'Strength', optional: true },
    glass: { title: 'What glass?', short: 'Glass', optional: true },
    notes: { title: 'How does it taste?', short: 'Notes', intro: 'Tap a few, or write a line.', optional: true },
    price: { title: 'What does it cost?', short: 'Price', optional: true },
    review: { title: 'Look right?', short: 'Review', optional: false },
  },
  wine: {
    name: { title: 'What’s the wine?', short: 'Name', optional: false },
    maker: { title: 'Who makes it?', short: 'Producer', optional: true },
    style: { title: 'What kind?', short: 'Kind', optional: true },
    strength: { title: 'How strong?', short: 'Strength', optional: true },
    glass: { title: 'What glass?', short: 'Glass', optional: true },
    notes: { title: 'How does it taste?', short: 'Notes', intro: 'Tap a few, or write a line.', optional: true },
    price: { title: 'What does it cost?', short: 'Price', intro: 'By the glass or the bottle, however your list prices it.', optional: true },
    review: { title: 'Look right?', short: 'Review', optional: false },
  },
};

/** A local photo picked or taken in the wizard, uploaded when it's saved. */
export interface DraftPhoto {
  uri: string;
  mimeType: string;
}

export interface BeerWineDraft {
  name: string;
  maker: string;
  /** A style chip ("IPA", "Red"): saved as that category when the catalog has it, and it draws the colour. */
  style: string | null;
  /** A region chip ("Belgium", "France"), saved as its category. */
  region: string | null;
  /** ABV in percent, as typed. */
  abv: string;
  /** How the glass is drawn ('beer_tulip'); null is the style's usual glass. */
  glassVariant: string | null;
  /** Tasting words, in the order tapped; they lead the description. */
  tasting: string[];
  description: string;
  price: string;
  /** Where it's from ("Portland, USA"), filled from the catalog. */
  origin: string | null;
  photo: DraftPhoto | null;
}

export const EMPTY_BEER_WINE: BeerWineDraft = {
  name: '',
  maker: '',
  style: null,
  region: null,
  abv: '',
  glassVariant: null,
  tasting: [],
  description: '',
  price: '',
  origin: null,
  photo: null,
};

interface Style {
  name: string;
  /** Its colour in the glass, from the sketch palette. */
  color: keyof typeof DRINK_COLORS;
  /** A usual strength, offered first. */
  abv: number;
  /** The glass drawing it's usually poured in. */
  variant: string;
  /** Matches what a label calls it ("India pale ale", "Cabernet"). */
  match: RegExp;
}

const s = (name: string, color: Style['color'], abv: number, variant: string, match: RegExp): Style => ({ name, color, abv, variant, match });

/** Styles in the order people reach for them; names match the seeded categories (seed_categories.sql). */
export const STYLES: Record<DrinkKind, readonly Style[]> = {
  beer: [
    s('Lager', 'gold', 4.8, 'beer_shaker', /lager|helles|helle|dortmunder|light beer/),
    s('Pilsner', 'pale_straw', 5, 'beer_pilsner', /pils/),
    s('IPA', 'amber', 6.5, 'beer_tulip', /ipa|india pale/),
    s('Pale Ale', 'amber', 5, 'beer_nonic', /pale ale|bitter|apa\b/),
    s('Wheat Beer', 'yellow', 5.2, 'beer_weizen', /wheat|wit|weiss|weizen|hefe|blanche/),
    s('Stout', 'black', 5, 'beer_nonic', /stout/),
    s('Porter', 'dark_brown', 5.5, 'beer_nonic', /porter/),
    s('Amber Ale', 'copper', 5.2, 'beer_nonic', /amber|red ale|brown ale|vienna/),
    s('Sour', 'coral', 4.5, 'beer_tulip', /sour|gose|lambic|kriek|berliner/),
    s('Saison', 'gold', 6.5, 'beer_tulip', /saison|farmhouse|tripel|dubbel|abbey|belgian/),
  ],
  wine: [
    s('Red', 'ruby', 13.5, 'wine_bordeaux', /red|rouge|tinto|rosso|cabernet|merlot|pinot noir|shiraz|syrah|malbec|tempranillo|sangiovese|nebbiolo|grenache|garnacha|zinfandel/),
    s('White', 'pale_straw', 12.5, 'wine_white', /white|blanc|bianco|chardonnay|sauvignon|riesling|pinot gri|albari|chenin|gr[uü]ner|soave/),
    s('Rosé', 'blush', 12, 'wine_white', /ros[eé]|rosado|rosato/),
    s('Sparkling', 'pale_straw', 12, 'flute_tulip', /sparkling|champagne|prosecco|cava|cr[eé]mant|spumante|sekt|p[eé]t[- ]?nat/),
    s('Orange', 'peach', 12.5, 'wine_universal', /orange|skin[- ]contact|amber wine/),
    s('Dessert', 'gold', 12, 'wine_copita', /dessert|sauternes|tokaj|ice ?wine|late harvest|moscato/),
    s('Fortified', 'copper', 19, 'wine_copita', /fortified|port\b|sherry|madeira|marsala|vermouth/),
  ],
};

export const styleOf = (kind: DrinkKind, name: string | null) => STYLES[kind].find((x) => x.name === name) ?? null;

/** The style a label or catalog note names ("London dry" is nothing; "Hazy IPA" is IPA). */
export function guessStyle(kind: DrinkKind, text: string | null | undefined): string | null {
  const t = (text ?? '').toLowerCase();
  if (!t) return null;
  return STYLES[kind].find((x) => x.match.test(t))?.name ?? null;
}

/** Regions offered as chips; names match the seeded categories. */
export const REGIONS: Record<DrinkKind, readonly string[]> = {
  beer: ['USA', 'Belgium', 'Germany', 'UK', 'Canada'],
  wine: ['France', 'Italy', 'Spain', 'USA - California', 'Australia', 'New Zealand', 'Argentina', 'Chile', 'South Africa'],
};

export const TASTING: Record<DrinkKind, readonly string[]> = {
  beer: ['Crisp', 'Hoppy', 'Malty', 'Roasty', 'Fruity', 'Hazy', 'Sour', 'Bitter', 'Light', 'Rich', 'Dry', 'Smooth'],
  wine: ['Dry', 'Fruity', 'Crisp', 'Bold', 'Light', 'Oaky', 'Earthy', 'Mineral', 'Sweet', 'Tannic', 'Juicy', 'Floral'],
};

/** "Crisp, hoppy and dry." */
export function tastingLine(words: readonly string[]): string {
  if (!words.length) return '';
  const w = words.map((x, i) => (i === 0 ? x : x.toLowerCase()));
  return `${w.length < 2 ? w[0] : `${w.slice(0, -1).join(', ')} and ${w.at(-1)}`}.`;
}

/** The description saved: the tasting words, then what was written. */
export const fullDescription = (d: BeerWineDraft) => [tastingLine(d.tasting), d.description.trim()].filter(Boolean).join(' ');

/** The glasses each kind is drawn in, for the glass step. */
export const glassFor = (kind: DrinkKind, style: string | null): SketchInputs['glass'] => (kind === 'beer' ? 'beer' : style === 'Sparkling' ? 'flute' : 'wine');

/** The drawing: the style's colour in its glass, a head on a beer, bubbles where there are some. */
export function beerWineSketch(kind: DrinkKind, d: Pick<BeerWineDraft, 'style' | 'glassVariant'>): SketchInputs {
  const style = styleOf(kind, d.style);
  const glass = glassFor(kind, d.style);
  const usual = style?.variant.startsWith(`${glass}_`) ? style.variant : null;
  const variant = d.glassVariant?.startsWith(`${glass}_`) ? d.glassVariant : usual;
  const color = style?.color ?? (kind === 'beer' ? 'gold' : 'ruby');
  const beer = kind === 'beer';
  return {
    v: SKETCH_VERSION,
    glass,
    ice: 'none',
    method: 'pour',
    liquid: { hex: DRINK_COLORS[color].toLowerCase(), alpha: beer || color === 'ruby' ? 0.85 : 0.6 },
    foam: beer ? (style?.name === 'Stout' ? 'crema' : 'cap') : null,
    float: null,
    bleed: null,
    fizz: beer || style?.name === 'Sparkling',
    garnish: style?.name === 'Wheat Beer' ? 'orange_wheel' : null,
    from: { glass: 'data', ice: 'data', method: 'data', liquid: 'rules', garnish: 'default' },
    coverage: 1,
    variant,
  };
}

/** A saved beer or wine's drawing, as its page shows it with no photo: the style from its tags, the glass it was saved with. */
export const savedSketch = (kind: DrinkKind, tags: readonly string[], variant: string | null) =>
  beerWineSketch(kind, { style: STYLES[kind].find((x) => tags.includes(x.name))?.name ?? null, glassVariant: variant });

/** Strengths offered as chips, the style's usual one first. */
export function strengthChips(kind: DrinkKind, style: string | null): number[] {
  const usual = styleOf(kind, style)?.abv;
  const base = kind === 'beer' ? [4.2, 4.8, 5, 5.5, 6.5, 8] : [11, 12, 12.5, 13, 13.5, 14.5];
  return usual ? [usual, ...base.filter((n) => n !== usual)] : base;
}

/** One tap of − or + on the ABV: tenths for beer and wine alike, from the style's usual when empty. */
export function stepAbv(abv: string, dir: 1 | -1, start: number): string {
  const n = parseFloat(abv.replace(',', '.'));
  const next = Number.isFinite(n) ? n + dir * 0.1 : start;
  return String(Math.max(0, Math.min(100, Math.round(next * 10) / 10)));
}

/** A shared beer or wine to start from, as the name step finds it. */
export interface CatalogBottle {
  id: string;
  name: string;
  brand_maker: string | null;
  abv: number | null;
  description: string | null;
  origin: string | null;
  /** Its category names ("IPA", "Belgium"). */
  categories: string[];
}

/** What a catalog entry fills in: maker, strength, style, region, notes and origin. The name and anything typed already stay. */
export function fillFromCatalog(kind: DrinkKind, d: BeerWineDraft, c: CatalogBottle): Partial<BeerWineDraft> {
  const style = STYLES[kind].find((x) => c.categories.includes(x.name))?.name ?? guessStyle(kind, `${c.name} ${c.description ?? ''}`);
  const region = REGIONS[kind].find((r) => c.categories.includes(r)) ?? REGIONS[kind].find((r) => (c.origin ?? '').split(/,\s*/).includes(r)) ?? null;
  return {
    maker: d.maker || c.brand_maker || '',
    abv: d.abv || (c.abv !== null ? String(c.abv) : ''),
    style: d.style ?? style,
    region: d.region ?? region,
    description: d.description || c.description || '',
    origin: d.origin ?? c.origin,
  };
}

/** What a label read from a photo fills in (read-bottle): name, maker, strength and style. */
export function fillFromLabel(kind: DrinkKind, d: BeerWineDraft, label: { brand: string | null; name: string; kind: string | null; abv: number | null }): Partial<BeerWineDraft> {
  return {
    name: d.name.trim() || label.name,
    maker: d.maker || label.brand || '',
    abv: d.abv || (label.abv !== null ? String(label.abv) : ''),
    style: d.style ?? guessStyle(kind, `${label.kind ?? ''} ${label.name}`),
  };
}
