export type SectionDrinkType = 'cocktail' | 'beer' | 'wine';

const ALL_SECTION_DRINK_TYPES: SectionDrinkType[] = ['cocktail', 'beer', 'wine'];

/** A menu section's allowed_types as stored, cleaned up: known types only, in order, never empty. */
export function normalizeAllowedTypes(raw: unknown): SectionDrinkType[] {
  const list = Array.isArray(raw) ? raw : ALL_SECTION_DRINK_TYPES;
  const set = new Set(
    list.filter((t): t is SectionDrinkType => t === 'cocktail' || t === 'beer' || t === 'wine')
  );
  const ordered = ALL_SECTION_DRINK_TYPES.filter((t) => set.has(t));
  return ordered.length ? ordered : [...ALL_SECTION_DRINK_TYPES];
}
