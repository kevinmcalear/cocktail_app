import { addDrink, addSection, type MenuLayout } from '@/lib/menuLayout';
import { RECIPE_UNITS } from '@/lib/units';
import type { MenuDrink } from '@/types/menus';

/** Collapse case and spacing so "Roku  Gin" and "roku gin" are the same name. */
export function normName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

const UNIT_BY_WORD: Record<string, string> = {};
const plural = (label: string) => (/(?:s|x|z|ch|sh)$/.test(label) ? `${label}es` : `${label}s`);
for (const unit of RECIPE_UNITS) {
  UNIT_BY_WORD[unit.value] = unit.value;
  UNIT_BY_WORD[unit.label] = unit.value;
  UNIT_BY_WORD[plural(unit.label)] = unit.value;
}
Object.assign(UNIT_BY_WORD, {
  ounce: 'oz',
  ounces: 'oz',
  milliliter: 'ml',
  milliliters: 'ml',
  millilitre: 'ml',
  millilitres: 'ml',
  gram: 'g',
  grams: 'g',
  leaves: 'leaf',
  peels: 'peel',
  twists: 'twist',
  wheels: 'wheel',
  slices: 'slice',
  cubes: 'cube',
});

export function parseAmount(raw: string): number | null {
  const text = raw.trim();
  const mixed = text.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const denom = Number(mixed[3]);
    return denom ? Number(mixed[1]) + Number(mixed[2]) / denom : null;
  }
  const fraction = text.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const denom = Number(fraction[2]);
    return denom ? Number(fraction[1]) / denom : null;
  }
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export interface SpecLine {
  amount: number;
  unit: string;
  name: string;
}

/** "30 ml Gin", "1/2 oz lemon", "2 dashes bitters". Null when it isn't an amount. */
export function parseSpecLine(row: string): SpecLine | null {
  const match = row.trim().match(/^((?:\d+\s+)?\d+\/\d+|\d+\.\d+|\d+)\s*([A-Za-z]+)\s+(.+)$/);
  if (!match) return null;
  const amount = parseAmount(match[1]);
  const unit = UNIT_BY_WORD[match[2].toLowerCase()];
  if (amount === null || !unit) return null;
  return { amount, unit, name: match[3].trim() };
}

export interface ParsedMenuLine {
  name: string;
  price: string | null;
}

export interface ParsedMenuSection {
  /** Null: drinks that came before the first heading. */
  name: string | null;
  lines: ParsedMenuLine[];
}

function parseMenuLine(row: string): ParsedMenuLine {
  const parts = row.split(/\s+[—–-]\s+/);
  if (parts.length >= 2) {
    const price = parts[parts.length - 1].trim();
    if (/^(\d+(\.\d{1,2})?|mp)$/i.test(price)) {
      return { name: parts.slice(0, -1).join(' - ').trim(), price: /^mp$/i.test(price) ? 'MP' : price };
    }
  }
  return { name: row, price: null };
}

/**
 * A pasted menu. A line ending in a colon is a section, unless this paste is
 * going into one section already, in which case those lines are skipped.
 */
export function parseMenuPaste(text: string, intoSection: boolean): ParsedMenuSection[] {
  const rows = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (intoSection) {
    const lines = rows.filter((row) => !row.endsWith(':')).map(parseMenuLine);
    return lines.length ? [{ name: null, lines }] : [];
  }
  const sections: ParsedMenuSection[] = [];
  let current: ParsedMenuSection = { name: null, lines: [] };
  for (const row of rows) {
    if (row.endsWith(':')) {
      if (current.name || current.lines.length) sections.push(current);
      current = { name: row.slice(0, -1).trim() || null, lines: [] };
      continue;
    }
    current.lines.push(parseMenuLine(row));
  }
  if (current.name || current.lines.length) sections.push(current);
  return sections;
}

export interface PlacedGroup {
  name: string | null;
  drinks: MenuDrink[];
}

/** Adds the checked drinks to the layout. Named groups become new sections. */
export function applyMenuPaste(layout: MenuLayout, intoKey: string | null, groups: PlacedGroup[]): MenuLayout {
  if (intoKey) return groups.reduce((acc, group) => group.drinks.reduce((next, drink) => addDrink(next, intoKey, drink), acc), layout);
  let next = layout;
  const intoLast = (drinks: MenuDrink[]) => {
    if (!drinks.length) return;
    if (!next.sections.length) next = addSection(next, 'Drinks');
    const key = next.sections[next.sections.length - 1].key;
    for (const drink of drinks) next = addDrink(next, key, drink);
  };
  let pending: MenuDrink[] = [];
  for (const group of groups) {
    if (!group.name) {
      pending.push(...group.drinks);
      continue;
    }
    intoLast(pending);
    pending = [];
    next = addSection(next, group.name);
    intoLast(group.drinks);
  }
  intoLast(pending);
  return next;
}

export type NameMatch<T> = { kind: 'one'; item: T } | { kind: 'many'; items: T[] } | { kind: 'none' };

export function matchByName<T extends { name: string }>(name: string, items: T[]): NameMatch<T> {
  const want = normName(name);
  const found = items.filter((item) => normName(item.name) === want);
  if (found.length === 1) return { kind: 'one', item: found[0] };
  if (found.length > 1) return { kind: 'many', items: found };
  return { kind: 'none' };
}

export interface CatalogItem {
  id: string;
  name: string;
  genericId: string | null;
  barId: string | null;
}

export type IngredientMatch =
  | { kind: 'use'; id: string }
  | { kind: 'pick'; options: { id: string; name: string }[] }
  | { kind: 'new'; name: string; genericId: string | null; genericName: string | null };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The longest known ingredient name that appears as a whole word in this one. */
export function suggestGeneric(name: string, catalog: CatalogItem[]): { id: string; name: string } | null {
  const want = normName(name);
  const referenced = new Set(catalog.map((item) => item.genericId).filter((id): id is string => !!id));
  const hits = catalog.filter((item) => {
    const kind = normName(item.name);
    if (kind.length < 3 || kind === want) return false;
    return new RegExp(`(?:^|\\s)${escapeRegExp(kind)}(?:\\s|$)`).test(want);
  });
  hits.sort((a, b) => Number(referenced.has(b.id)) - Number(referenced.has(a.id)) || normName(b.name).length - normName(a.name).length);
  return hits[0] ? { id: hits[0].id, name: hits[0].name } : null;
}

/**
 * Venue exact, then the shared catalog, then a kind with several bottles
 * (never an automatic pick). Otherwise a new ingredient, with a kind when the
 * name contains one.
 */
export function matchIngredient(name: string, catalog: CatalogItem[], venueId: string | null): IngredientMatch {
  const venue = catalog.filter((item) => item.barId === venueId);
  const shared = catalog.filter((item) => item.barId === null);
  const venueHit = matchByName(name, venue);
  if (venueHit.kind === 'one') return { kind: 'use', id: venueHit.item.id };
  if (venueHit.kind === 'many') return { kind: 'pick', options: venueHit.items.map(({ id, name: label }) => ({ id, name: label })) };
  const sharedHit = matchByName(name, shared);
  if (sharedHit.kind === 'one') return { kind: 'use', id: sharedHit.item.id };
  if (sharedHit.kind === 'many') return { kind: 'pick', options: sharedHit.items.map(({ id, name: label }) => ({ id, name: label })) };

  const want = normName(name);
  const generics = catalog.filter((item) => normName(item.name) === want);
  const genericIds = new Set(generics.map((item) => item.id));
  const bottles = venue.filter((item) => item.genericId && genericIds.has(item.genericId) && normName(item.name) !== want);
  if (bottles.length) {
    const options = [...generics, ...bottles];
    const seen = new Set<string>();
    return {
      kind: 'pick',
      options: options.filter((item) => (seen.has(item.id) ? false : !!seen.add(item.id))).map((item) => ({ id: item.id, name: item.name })),
    };
  }
  const generic = suggestGeneric(name, catalog);
  return { kind: 'new', name: name.trim(), genericId: generic?.id ?? null, genericName: generic?.name ?? null };
}

export interface BringBlock {
  name: string;
  lines: SpecLine[];
  notes: string[];
  kind: 'cocktail' | 'house' | 'bottle';
}

/** Blank line, next drink. No amounts at all: one bottle or empty drink per line. */
export function parseBringIn(text: string, mode: 'drinks' | 'ingredients'): BringBlock[] {
  const rows = text.split('\n').map((line) => line.trim());
  const filled = rows.filter(Boolean);
  if (!filled.length) return [];
  const asBottle = (name: string): BringBlock => ({ name, lines: [], notes: [], kind: mode === 'ingredients' ? 'bottle' : 'cocktail' });
  if (!filled.some((row) => parseSpecLine(row))) return filled.map(asBottle);

  const groups: string[][] = [[]];
  for (const row of rows) {
    if (!row) {
      if (groups[groups.length - 1].length) groups.push([]);
      continue;
    }
    groups[groups.length - 1].push(row);
  }
  return groups.filter((group) => group.length).map((group) => {
    const [first, ...rest] = group;
    if (parseSpecLine(first)) return { name: '', lines: [], notes: [], kind: 'cocktail' as const };
    const lines: SpecLine[] = [];
    const notes: string[] = [];
    for (const row of rest) {
      const spec = parseSpecLine(row);
      if (spec) lines.push(spec);
      else notes.push(row);
    }
    const kind = mode === 'ingredients' ? (lines.length ? 'house' : 'bottle') : 'cocktail';
    return { name: first, lines, notes, kind };
  });
}

export interface NamedItem {
  id: string;
  name: string;
}

/** A trailing line that is exactly a method or a glass is that, not a note. */
export function classifyNotes(notes: string[], methods: NamedItem[], glasses: NamedItem[]): { methodId: string | null; glassId: string | null; notes: string[] } {
  const find = (note: string, items: NamedItem[]) => items.find((item) => normName(item.name) === normName(note.replace(/\.$/, '')))?.id ?? null;
  let methodId: string | null = null;
  let glassId: string | null = null;
  const left: string[] = [];
  for (const note of notes) {
    const methodHit: string | null = !methodId ? find(note, methods) : null;
    const glassHit: string | null = !glassId ? find(note, glasses) : null;
    if (methodHit) methodId = methodHit;
    else if (glassHit) glassId = glassHit;
    else left.push(note);
  }
  return { methodId, glassId, notes: left };
}

export interface BringWrite {
  creates: { key: string; name: string; genericId: string | null }[];
  items: {
    name: string;
    kind: 'cocktail' | 'ingredient';
    notes: string | null;
    methodId: string | null;
    glassId: string | null;
    lines: { ingredientKey: string; amount: number | null; unit: string | null }[];
  }[];
}

/**
 * picks: "block:line" -> ingredient id, for a line with several bottles.
 * kinds: create key -> kind name the person typed. Missing means the suggestion.
 */
export function compileBringIn(
  blocks: BringBlock[],
  catalog: CatalogItem[],
  venueId: string | null,
  picks: Record<string, string>,
  kinds: Record<string, string>,
  methods: NamedItem[],
  glasses: NamedItem[],
): { error: string | null; write: BringWrite | null } {
  if (blocks.some((block) => !block.name.trim())) return { error: 'Start each drink with its name, then the amounts.', write: null };
  const creates = new Map<string, { key: string; name: string; genericId: string | null }>();
  const items: BringWrite['items'] = [];
  const resolve = (name: string, pickKey: string): { error: string | null; ingredientKey: string | null } => {
    const match = matchIngredient(name, catalog, venueId);
    if (match.kind === 'use') return { error: null, ingredientKey: `id:${match.id}` };
    if (match.kind === 'pick') {
      const chosen = picks[pickKey];
      if (!chosen || !match.options.some((option) => option.id === chosen)) return { error: `Pick which ${name.trim()} you mean.`, ingredientKey: null };
      return { error: null, ingredientKey: `id:${chosen}` };
    }
    const key = normName(match.name);
    if (!creates.has(key)) {
      const typed = key in kinds ? kinds[key] : (match.genericName ?? '');
      let genericId: string | null = null;
      if (typed.trim()) {
        const kind = matchByName(typed, catalog);
        if (kind.kind !== 'one') return { error: `No single ingredient called “${typed.trim()}” to use as the kind of ${match.name}.`, ingredientKey: null };
        genericId = kind.item.id;
      }
      creates.set(key, { key, name: match.name, genericId });
    }
    return { error: null, ingredientKey: `new:${key}` };
  };

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.kind === 'bottle') {
      const resolved = resolve(block.name, `${i}:0`);
      if (resolved.error) return { error: resolved.error, write: null };
      continue;
    }
    const classified = classifyNotes(block.notes, methods, glasses);
    const lines: BringWrite['items'][number]['lines'] = [];
    for (let j = 0; j < block.lines.length; j++) {
      const line = block.lines[j];
      const resolved = resolve(line.name, `${i}:${j}`);
      if (resolved.error || !resolved.ingredientKey) return { error: resolved.error, write: null };
      lines.push({ ingredientKey: resolved.ingredientKey, amount: line.amount, unit: line.unit });
    }
    items.push({
      name: block.name.trim(),
      kind: block.kind === 'house' ? 'ingredient' : 'cocktail',
      notes: classified.notes.length ? classified.notes.join('\n') : null,
      methodId: classified.methodId,
      glassId: classified.glassId,
      lines,
    });
  }
  return { error: null, write: { creates: [...creates.values()], items } };
}
