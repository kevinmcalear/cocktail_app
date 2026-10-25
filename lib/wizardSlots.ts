/**
 * Which kept draft the add-drink wizard opens (store/useDrinkWizardStore).
 * A plain New drink keeps one per place ('home' or a venue's id). A drink
 * started for a menu section, by name ("Make Salty Boy") or from another
 * drink keeps its own, so starting one never opens a different drink left
 * half made, and a menu can show the ones started on it (Kevin, 24 Oct).
 */
export interface SlotStart {
  menuSectionId?: string | null;
  name?: string | null;
  /** A drink to start from: a riff, the first round's Old Fashioned. */
  from?: string | null;
}

const MENU = '|menu:';
const NAME = '|name:';

export function draftSlot(place: string, { menuSectionId, name, from }: SlotStart): string {
  const named = name?.trim().toLowerCase();
  return [place, menuSectionId ? `${MENU}${menuSectionId}` : '', from ? `|from:${from}` : '', named ? `${NAME}${named}` : ''].join('');
}

/**
 * The drafts started for this menu section at this place, newest first, with
 * the name each was opened with: opening the wizard with it again (and the
 * section) is the same slot.
 */
export function sectionSlots<K extends { updatedAt: number }>(kept: Record<string, K>, place: string, sectionKey: string): { slot: string; name: string | null; kept: K }[] {
  const start = `${place}${MENU}${sectionKey}`;
  return Object.entries(kept)
    .filter(([slot]) => slot === start || slot.startsWith(`${start}${NAME}`))
    .map(([slot, k]) => ({ slot, name: slot === start ? null : slot.slice(start.length + NAME.length), kept: k }))
    .sort((a, b) => b.kept.updatedAt - a.kept.updatedAt);
}
