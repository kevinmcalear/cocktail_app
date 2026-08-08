/** ⌘K / home catalog: skip items flagged hide-from-search. Pickers still show them. */
export function isHiddenFromSearch(item: {
  hide_from_search?: boolean | null;
  draft_data?: { hideFromSearch?: boolean | null } | null;
}) {
  if (item.hide_from_search === true) return true;
  if (item.draft_data?.hideFromSearch === true) return true;
  return false;
}
