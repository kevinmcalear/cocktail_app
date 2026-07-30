import type { CommandFilter } from '@/components/CommandSearch';

export type SectionDrinkType = 'cocktail' | 'beer' | 'wine';

export const ALL_SECTION_DRINK_TYPES: SectionDrinkType[] = ['cocktail', 'beer', 'wine'];

const TYPE_TO_FILTER: Record<SectionDrinkType, CommandFilter> = {
  cocktail: 'Cocktails',
  beer: 'Beer',
  wine: 'Wine',
};

const TYPE_LABEL: Record<SectionDrinkType, string> = {
  cocktail: 'Cocktails',
  beer: 'Beer',
  wine: 'Wine',
};

export function normalizeAllowedTypes(raw: unknown): SectionDrinkType[] {
  const list = Array.isArray(raw) ? raw : ALL_SECTION_DRINK_TYPES;
  const set = new Set(
    list.filter((t): t is SectionDrinkType => t === 'cocktail' || t === 'beer' || t === 'wine')
  );
  const ordered = ALL_SECTION_DRINK_TYPES.filter((t) => set.has(t));
  return ordered.length ? ordered : [...ALL_SECTION_DRINK_TYPES];
}

export function sectionCommandFilter(types: SectionDrinkType[]): CommandFilter {
  if (types.length === 1) return TYPE_TO_FILTER[types[0]];
  return 'All';
}

/** Filter pills shown in Add picker for this section. */
export function sectionCommandFilters(types: SectionDrinkType[]): CommandFilter[] {
  if (types.length === 1) return [TYPE_TO_FILTER[types[0]]];
  return ['All', ...types.map((t) => TYPE_TO_FILTER[t])];
}

export function drinkTypeOf(item: { id: string; category?: string | null }): SectionDrinkType {
  if (item.category === 'Beer' || item.id.startsWith('beer-')) return 'beer';
  if (item.category === 'Wine' || item.id.startsWith('wine-')) return 'wine';
  return 'cocktail';
}

export function itemAllowedInSection(
  item: { id: string; category?: string | null },
  types: SectionDrinkType[]
): boolean {
  return types.includes(drinkTypeOf(item));
}

/** Cocktail/beer/wine tiles — not menus, ingredients, or categories. */
export function isSectionDrinkItem(item: {
  id: string;
  category?: string | null;
}): boolean {
  if (
    item.category === 'Menu' ||
    item.category === 'Ingredient' ||
    item.category === 'Category'
  ) {
    return false;
  }
  if (item.id.startsWith('menu-')) return false;
  return true;
}

export function allowedTypesLabel(types: SectionDrinkType[]): string {
  if (types.length === ALL_SECTION_DRINK_TYPES.length) return 'Cocktails, Beer & Wine';
  if (types.length === 1) return `${TYPE_LABEL[types[0]]} only`;
  return types.map((t) => TYPE_LABEL[t]).join(' & ');
}

/** Resolve what to create from the active Command-K filter (+ available pills). */
export function createTypeFromFilter(
  filter: CommandFilter,
  available: readonly CommandFilter[] = ['Cocktails', 'Beer', 'Wine']
): SectionDrinkType | null {
  if (filter === 'Cocktails') return 'cocktail';
  if (filter === 'Beer') return 'beer';
  if (filter === 'Wine') return 'wine';
  if (filter !== 'All') return null;
  const drink = available.filter(
    (f): f is 'Cocktails' | 'Beer' | 'Wine' =>
      f === 'Cocktails' || f === 'Beer' || f === 'Wine'
  );
  if (drink.length === 1) {
    return drink[0] === 'Cocktails' ? 'cocktail' : drink[0] === 'Beer' ? 'beer' : 'wine';
  }
  if (drink.includes('Cocktails')) return 'cocktail';
  if (drink.includes('Beer')) return 'beer';
  if (drink.includes('Wine')) return 'wine';
  return null;
}
