// Drafts saved to the account (the `drafts` table) by the older editors: what
// each is called, where it opens, and how the Drafts screen groups them.

export interface DraftRow {
  id: string;
  entity_type: string;
  bar_id?: string | null;
  updated_at: string;
  draft_data?: { name?: string; menuName?: string } | null;
}

const ROUTE: Record<string, string> = {
  cocktail: '/add-cocktail',
  beer: '/add-beer',
  wine: '/add-wine',
  ingredient: '/add-ingredient',
  // ponytail: menu drafts came from the old menu creator, which is gone. They
  // list (and delete) but don't open; converting them to menus is Kevin's call.
};

export const DRAFT_KIND_LABEL: Record<string, string> = {
  cocktail: 'Drink',
  beer: 'Beer',
  wine: 'Wine',
  ingredient: 'Ingredient',
  menu: 'Menu',
};

/** Where a draft opens to carry on, or null when no editor opens that kind any more. */
export function draftHref(d: Pick<DraftRow, 'id' | 'entity_type' | 'bar_id'>): string | null {
  const route = ROUTE[d.entity_type];
  if (!route) return null;
  const bar = d.bar_id ? `&barId=${encodeURIComponent(d.bar_id)}` : '';
  return `${route}?draftId=${encodeURIComponent(d.id)}${bar}`;
}

export function draftTitle(d: DraftRow): string {
  const name = d.draft_data?.name?.trim() || d.draft_data?.menuName?.trim();
  return name || `Untitled ${(DRAFT_KIND_LABEL[d.entity_type] ?? 'draft').toLowerCase()}`;
}

/** One group per venue, in the order their newest draft was touched; the person's own (no venue) are keyed ''. */
export function groupDrafts<T extends DraftRow>(drafts: readonly T[]): { barId: string; drafts: T[] }[] {
  const sorted = [...drafts].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const groups = new Map<string, T[]>();
  for (const d of sorted) {
    const key = d.bar_id ?? '';
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  return [...groups].map(([barId, list]) => ({ barId, drafts: list }));
}
