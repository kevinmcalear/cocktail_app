import type { IngredientAlias } from '@/lib/ingredientNames';
import { matchIngredient, matchKey, matchName, type CatalogItem } from '@/lib/match';
import { addDrink, addSection, type EditSection, type MenuLayout } from '@/lib/menuLayout';
import { RECIPE_UNITS } from '@/lib/units';
import type { AnythingReading } from '@/supabase/functions/_shared/anythingRead';
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
  /** Null for an ingredient listed without an amount ("- Campari"). */
  amount: number | null;
  unit: string | null;
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

/** A spec line, or "- Campari" (an ingredient with no amount, as a printed menu lists it). */
function parseBringRow(row: string): SpecLine | null {
  const listed = row.trim().match(/^[-•*]\s*(.+)$/);
  return listed ? { amount: null, unit: null, name: listed[1].trim() } : parseSpecLine(row);
}

export interface ParsedMenuLine {
  name: string;
  price: string | null;
  /** What a printed menu lists under the drink (read-menu only). */
  ingredients?: string[];
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

export type PasteRow =
  /** `note`: what happens to the price, if anything. */
  | { key: string; section: string | null; status: 'add'; drink: MenuDrink; price: string | null; note: string | null }
  | { key: string; section: string | null; status: 'pick'; name: string; options: MenuDrink[] }
  | { key: string; section: string | null; status: 'missing'; name: string; ingredients: string[] }
  | { key: string; section: string | null; status: 'skip'; name: string; note: string };

/**
 * Each pasted (or photographed) line against the library: added, a pick
 * between same-named drinks, missing, or skipped. `into` is the section a
 * paste fills (null for a whole menu); `already` the drinks already in the
 * section a heading-less paste lands in; `picks` line key -> drink id.
 */
export function pasteRows(
  sections: ParsedMenuSection[],
  library: MenuDrink[],
  picks: Record<string, string>,
  into: EditSection | null = null,
  already: string[] = [],
): PasteRow[] {
  const out: PasteRow[] = [];
  const seen = new Set(into?.drinks.map((drink) => drink.id) ?? []);
  const parked = new Set(already);
  sections.forEach((section, si) => {
    section.lines.forEach((line, li) => {
      const key = `${si}:${li}`;
      const match = matchName(line.name, library);
      const place = (drink: MenuDrink) => {
        if (into && !into.allowedTypes.includes(drink.kind)) {
          out.push({ key, section: section.name, status: 'skip', name: drink.name, note: `${into.name} doesn’t take ${drink.kind}` });
          return;
        }
        if (seen.has(drink.id) || (!into && !section.name && parked.has(drink.id))) {
          out.push({ key, section: section.name, status: 'skip', name: drink.name, note: 'Already on this menu' });
          return;
        }
        seen.add(drink.id);
        const price = !drink.price && line.price ? line.price : null;
        const note = drink.price && line.price ? `Price stays ${drink.price}` : price ? `Price ${price}` : null;
        out.push({ key, section: section.name, status: 'add', drink: price ? { ...drink, price } : drink, price, note });
      };
      if (match.kind === 'one') place(match.item);
      else if (match.kind === 'pick') {
        const chosen = match.items.find((item) => item.id === picks[key]);
        if (chosen) place(chosen);
        else out.push({ key, section: section.name, status: 'pick', name: line.name, options: match.items });
      } else out.push({ key, section: section.name, status: 'missing', name: line.name, ingredients: line.ingredients ?? [] });
    });
  });
  return out;
}

/** The added rows, in order, as groups for applyMenuPaste. Into one section, headings don't matter. */
export function placedGroups(rows: PasteRow[], intoSection: boolean): PlacedGroup[] {
  const groups: PlacedGroup[] = [];
  for (const row of rows) {
    if (row.status !== 'add') continue;
    const name = intoSection ? null : row.section;
    const last = groups[groups.length - 1];
    if (last && last.name === name) last.drinks.push(row.drink);
    else groups.push({ name, drinks: [row.drink] });
  }
  return groups;
}

/** A second reading (another page) after the first: a heading carried over the page break joins its section. */
export function appendReading(sections: ParsedMenuSection[], more: ParsedMenuSection[]): ParsedMenuSection[] {
  const [first, ...rest] = more;
  const last = sections[sections.length - 1];
  if (!first) return sections;
  if (last && (first.name === null || first.name === last.name)) {
    return [...sections.slice(0, -1), { ...last, lines: [...last.lines, ...first.lines] }, ...rest];
  }
  return [...sections, ...more];
}

/**
 * Drinks for Bring in: a name a line, or, when any has ingredients, a block
 * each with its ingredients as "- " lines (no amounts yet).
 */
export function bringInText(drinks: { name: string; ingredients: string[] }[]): string {
  if (!drinks.some((drink) => drink.ingredients.length)) return drinks.map((drink) => drink.name).join('\n');
  return drinks.map((drink) => [drink.name, ...drink.ingredients.map((name) => `- ${name}`)].join('\n')).join('\n\n');
}

/** 0.75 -> "0.75", 30 -> "30": what parseAmount reads back. */
const amountText = (n: number) => String(Math.round(n * 100) / 100);

/**
 * A read-anything reading as Bring in text, in the mode it belongs in, plus
 * the lines that were hard to read ("Orchard Fizz: Lemon Juice") so the
 * screen can ask for a look. A menu's drinks come in as names with their
 * listed ingredients; bottles as one name a line.
 */
export function readingText(reading: AnythingReading): { mode: 'drinks' | 'ingredients'; text: string; unsure: string[] } {
  if (reading.kind === 'bottles') return { mode: 'ingredients', text: reading.bottles.map((b) => b.name).join('\n'), unsure: [] };
  if (reading.kind === 'menu') {
    const drinks = (reading.menu?.sections ?? []).flatMap((section) => section.lines.map((line) => ({ name: line.name, ingredients: line.ingredients })));
    return { mode: 'drinks', text: bringInText(drinks), unsure: [] };
  }
  const unsure: string[] = [];
  const blocks = reading.recipes.map((recipe) => {
    const rows = [recipe.name];
    for (const line of recipe.lines) {
      if (line.unsure) unsure.push(`${recipe.name}: ${line.ingredient}`);
      rows.push(line.amount !== null && line.unit ? `${amountText(line.amount)} ${line.unit} ${line.ingredient}` : `- ${line.ingredient}`);
    }
    for (const note of [recipe.method, recipe.glass, recipe.ice ? `Ice: ${recipe.ice}` : null, recipe.garnish ? `Garnish: ${recipe.garnish}` : null, recipe.by ? `By ${recipe.by}` : null, recipe.notes]) {
      if (note) rows.push(note);
    }
    return rows.join('\n');
  });
  return { mode: 'drinks', text: blocks.join('\n\n'), unsure };
}

export interface PlacedGroup {
  name: string | null;
  drinks: MenuDrink[];
}

/** Adds the checked drinks to the layout. Named groups become new sections. */
export function applyMenuPaste(layout: MenuLayout, intoKey: string | null, groups: PlacedGroup[]): MenuLayout {
  if (intoKey) return groups.reduce((acc, group) => group.drinks.reduce((next, drink) => addDrink(next, intoKey, drink), acc), layout);
  // A new menu's one empty section gives way when the paste brings its own headings.
  const fresh = layout.sections.length === 1 && !layout.sections[0].drinks.length && !!groups[0]?.name;
  let next = fresh ? { ...layout, sections: [] } : layout;
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

export interface BringBlock {
  name: string;
  lines: SpecLine[];
  notes: string[];
  kind: 'cocktail' | 'house' | 'bottle';
}

/** Blank line, next drink. No amounts (or "- " lines) at all: one bottle or empty drink per line. */
export function parseBringIn(text: string, mode: 'drinks' | 'ingredients'): BringBlock[] {
  const rows = text.split('\n').map((line) => line.trim());
  const filled = rows.filter(Boolean);
  if (!filled.length) return [];
  const asBottle = (name: string): BringBlock => ({ name, lines: [], notes: [], kind: mode === 'ingredients' ? 'bottle' : 'cocktail' });
  if (!filled.some((row) => parseBringRow(row))) return filled.map(asBottle);

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
    if (parseBringRow(first)) return { name: '', lines: [], notes: [], kind: 'cocktail' as const };
    const lines: SpecLine[] = [];
    const notes: string[] = [];
    for (const row of rest) {
      const spec = parseBringRow(row);
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
 * kinds: create key (matchKey) -> kind name the person typed. Missing means the suggestion.
 */
export function compileBringIn(
  blocks: BringBlock[],
  catalog: CatalogItem[],
  venueId: string | null,
  picks: Record<string, string>,
  kinds: Record<string, string>,
  methods: NamedItem[],
  glasses: NamedItem[],
  aliases: readonly IngredientAlias[] = [],
): { error: string | null; write: BringWrite | null } {
  if (blocks.some((block) => !block.name.trim())) return { error: 'Start each drink with its name, then the amounts.', write: null };
  const creates = new Map<string, { key: string; name: string; genericId: string | null }>();
  const items: BringWrite['items'] = [];
  const resolve = (name: string, pickKey: string): { error: string | null; ingredientKey: string | null } => {
    const match = matchIngredient(name, catalog, venueId, aliases);
    if (match.kind === 'one') return { error: null, ingredientKey: `id:${match.item.id}` };
    if (match.kind === 'pick') {
      const chosen = picks[pickKey];
      if (!chosen || !match.items.some((item) => item.id === chosen)) return { error: `Pick which ${name.trim()} you mean.`, ingredientKey: null };
      return { error: null, ingredientKey: `id:${chosen}` };
    }
    const label = name.trim();
    const key = matchKey(label);
    if (!creates.has(key)) {
      const typed = key in kinds ? kinds[key] : (match.kindItem?.name ?? '');
      let genericId: string | null = null;
      if (typed.trim()) {
        const kind = matchName(typed, catalog);
        if (kind.kind !== 'one') return { error: `No single ingredient called “${typed.trim()}” to use as the kind of ${label}.`, ingredientKey: null };
        genericId = kind.item.id;
      }
      creates.set(key, { key, name: label, genericId });
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
