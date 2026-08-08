/** Append drinkId to a menu section selection list (idempotent). */
export function withDrinkInSection(
  selections: Record<string, string[]>,
  sectionId: string,
  drinkId: string,
  replaceId?: string | null
): Record<string, string[]> {
  let list = [...(selections[sectionId] || [])];
  if (replaceId) list = list.filter((id) => id !== replaceId);
  if (!list.includes(drinkId)) list.push(drinkId);
  return { ...selections, [sectionId]: list };
}
