import type { SectionDrinkType } from '@/lib/sectionAllowedTypes';
import type { MenuDetail, MenuDrink } from '@/types/menus';

/**
 * A menu being edited: plain data the editor changes and save_menu() writes
 * in one go. Every change returns a new layout, so undoing a change or
 * discarding the lot is just keeping the old one.
 */
export interface EditSection {
  /** Stable while editing; a saved section's id, or a new one's temporary key. */
  key: string;
  /** Saved sections only. */
  id: string | null;
  name: string;
  minItems: number;
  maxItems: number | null;
  allowedTypes: SectionDrinkType[];
  drinks: MenuDrink[];
}

export interface MenuLayout {
  name: string;
  coverUrl: string | null;
  coverPosition: number;
  sections: EditSection[];
}

let counter = 0;
const newKey = () => `new-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function layoutFromMenu(menu: Pick<MenuDetail, 'name' | 'coverUrl' | 'coverPosition' | 'sections'>): MenuLayout {
  return {
    name: menu.name,
    coverUrl: menu.coverUrl,
    coverPosition: menu.coverPosition,
    sections: menu.sections.map((s) => ({ key: s.id, id: s.id, name: s.name, minItems: s.minItems, maxItems: s.maxItems, allowedTypes: s.allowedTypes, drinks: s.drinks })),
  };
}

/** Sections copied from another menu or a layout: same shape, not the same rows. */
export function copySections(sections: Omit<EditSection, 'key' | 'id'>[], withDrinks: boolean): EditSection[] {
  return sections.map((s) => ({ ...s, key: newKey(), id: null, drinks: withDrinks ? s.drinks : [] }));
}

export function blankSection(name = 'Drinks'): EditSection {
  return { key: newKey(), id: null, name, minItems: 1, maxItems: null, allowedTypes: ['cocktail', 'beer', 'wine'], drinks: [] };
}

const mapSection = (layout: MenuLayout, key: string, fn: (s: EditSection) => EditSection): MenuLayout => ({
  ...layout,
  sections: layout.sections.map((s) => (s.key === key ? fn(s) : s)),
});

/** Why a drink can't go in a section, or null when it can. */
export function cannotAdd(section: EditSection, drink: Pick<MenuDrink, 'id' | 'kind'>): string | null {
  if (section.drinks.some((d) => d.id === drink.id)) return `Already in ${section.name}`;
  if (!section.allowedTypes.includes(drink.kind)) return `${section.name} doesn’t take ${drink.kind === 'cocktail' ? 'cocktails' : drink.kind}`;
  return null;
}

export function addDrink(layout: MenuLayout, sectionKey: string, drink: MenuDrink, index?: number): MenuLayout {
  return mapSection(layout, sectionKey, (s) => {
    if (cannotAdd(s, drink)) return s;
    const drinks = [...s.drinks];
    drinks.splice(index ?? drinks.length, 0, drink);
    return { ...s, drinks };
  });
}

export function removeDrink(layout: MenuLayout, sectionKey: string, drinkId: string): MenuLayout {
  return mapSection(layout, sectionKey, (s) => ({ ...s, drinks: s.drinks.filter((d) => d.id !== drinkId) }));
}

/** Moves a drink within its section (clamped to the ends). */
export function moveDrink(layout: MenuLayout, sectionKey: string, from: number, to: number): MenuLayout {
  return mapSection(layout, sectionKey, (s) => {
    if (from < 0 || from >= s.drinks.length) return s;
    const drinks = [...s.drinks];
    const [d] = drinks.splice(from, 1);
    drinks.splice(Math.max(0, Math.min(to, drinks.length)), 0, d);
    return { ...s, drinks };
  });
}

/** The whole order of a section at once, as a drag-and-drop list reports it. */
export function setDrinks(layout: MenuLayout, sectionKey: string, drinks: MenuDrink[]): MenuLayout {
  return mapSection(layout, sectionKey, (s) => ({ ...s, drinks }));
}

export function addSection(layout: MenuLayout, name = 'New section'): MenuLayout {
  return { ...layout, sections: [...layout.sections, blankSection(name)] };
}

export function removeSection(layout: MenuLayout, sectionKey: string): MenuLayout {
  return { ...layout, sections: layout.sections.filter((s) => s.key !== sectionKey) };
}

export function moveSection(layout: MenuLayout, sectionKey: string, by: -1 | 1): MenuLayout {
  const i = layout.sections.findIndex((s) => s.key === sectionKey);
  const j = i + by;
  if (i < 0 || j < 0 || j >= layout.sections.length) return layout;
  const sections = [...layout.sections];
  [sections[i], sections[j]] = [sections[j], sections[i]];
  return { ...layout, sections };
}

export type SectionRule = Pick<EditSection, 'name' | 'minItems' | 'maxItems' | 'allowedTypes'>;

/** Renames a section or changes its rules. Drinks it no longer takes come off. */
export function updateSection(layout: MenuLayout, sectionKey: string, rule: SectionRule): MenuLayout {
  return mapSection(layout, sectionKey, (s) => ({
    ...s,
    ...rule,
    drinks: s.drinks.filter((d) => rule.allowedTypes.includes(d.kind)),
  }));
}

/** What's wrong with a section's settings, or null. Mirrors the database's checks. */
export function sectionRuleProblem(rule: SectionRule): string | null {
  if (!rule.name.trim()) return 'Give the section a name.';
  if (rule.name.trim().length > 80) return 'Keep the name under 80 characters.';
  if (!rule.allowedTypes.length) return 'Pick at least one kind of drink.';
  if (!Number.isInteger(rule.minItems) || rule.minItems < 0) return 'The minimum should be 0 or more.';
  if (rule.maxItems !== null && (!Number.isInteger(rule.maxItems) || rule.maxItems < Math.max(rule.minItems, 1))) {
    return 'The most drinks should be at least the minimum (and at least 1).';
  }
  return null;
}

/** What stops the layout saving, or null. */
export function layoutProblem(layout: MenuLayout): string | null {
  if (!layout.name.trim()) return 'Give the menu a name.';
  if (!layout.sections.length) return 'A menu needs at least one section.';
  for (const s of layout.sections) {
    const p = sectionRuleProblem(s);
    if (p) return `${s.name || 'A section'}: ${p}`;
  }
  return null;
}

/** save_menu()'s p_sections. */
export function savePayload(layout: MenuLayout) {
  return layout.sections.map((s) => ({
    id: s.id,
    name: s.name.trim(),
    min_items: s.minItems,
    max_items: s.maxItems,
    allowed_types: s.allowedTypes,
    item_ids: s.drinks.map((d) => d.id),
  }));
}

/** Whether anything would be saved: compares what save_menu() would write. */
export function layoutChanged(a: MenuLayout, b: MenuLayout): boolean {
  return (
    a.name.trim() !== b.name.trim() ||
    a.coverUrl !== b.coverUrl ||
    a.coverPosition !== b.coverPosition ||
    JSON.stringify(savePayload(a)) !== JSON.stringify(savePayload(b))
  );
}

/** Drinks that fit a section, matching a search, optionally only ones on no other menu. */
export function filterLibrary(library: MenuDrink[], section: Pick<EditSection, 'allowedTypes'>, query: string, freeOnly: boolean, elsewhere: Record<string, string>) {
  const q = query.trim().toLowerCase();
  return library.filter(
    (d) => section.allowedTypes.includes(d.kind) && (!q || d.name.toLowerCase().includes(q)) && (!freeOnly || !elsewhere[d.id])
  );
}

/** What a library row says about a drink: in this section, on another menu, or free. */
export function libraryNote(drink: Pick<MenuDrink, 'id'>, section: Pick<EditSection, 'name' | 'drinks'>, elsewhere: Record<string, string>): string {
  if (section.drinks.some((d) => d.id === drink.id)) return `Already in ${section.name}`;
  return elsewhere[drink.id] ? `On ${elsewhere[drink.id]}` : 'Not on a menu';
}
