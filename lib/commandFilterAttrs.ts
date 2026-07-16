/** Secondary search attrs and which entity filters they apply to. */

export type AttrKey =
  | 'method'
  | 'glassware'
  | 'ice'
  | 'family'
  | 'category'
  | 'beerStyle'
  | 'wineStyle'
  | 'spirit';

export type AttrSelection = Record<AttrKey, string[]>;

export const EMPTY_ATTRS: AttrSelection = {
  method: [],
  glassware: [],
  ice: [],
  family: [],
  category: [],
  beerStyle: [],
  wineStyle: [],
  spirit: [],
};

const ALL_KEYS = Object.keys(EMPTY_ATTRS) as AttrKey[];

/** Which secondary filter groups are meaningful for a top-level entity filter. */
export function allowedAttrKeys(filter: string): AttrKey[] {
  switch (filter) {
    case 'Cocktails':
      return ['method', 'glassware', 'ice', 'family', 'category', 'spirit'];
    case 'Beer':
      return ['beerStyle'];
    case 'Wine':
      return ['wineStyle'];
    case 'Ingredients':
      return ['spirit'];
    case 'Menus':
      return [];
    case 'All':
    default:
      return ALL_KEYS;
  }
}

/** Drop selections that don't apply to the current entity filter. */
export function pruneAttrs(attrs: AttrSelection, filter: string): AttrSelection {
  const allowed = new Set(allowedAttrKeys(filter));
  const next = { ...EMPTY_ATTRS };
  for (const key of ALL_KEYS) {
    next[key] = allowed.has(key) ? attrs[key] : [];
  }
  return next;
}

export function appliedAttrPills(
  attrs: AttrSelection,
  labelFor: (key: AttrKey, id: string) => string | undefined
): { key: AttrKey; id: string; label: string }[] {
  const out: { key: AttrKey; id: string; label: string }[] = [];
  for (const key of ALL_KEYS) {
    for (const id of attrs[key]) {
      const label = labelFor(key, id);
      if (label) out.push({ key, id, label });
    }
  }
  return out;
}
