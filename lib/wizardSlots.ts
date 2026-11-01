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
  /** An import review's drink in the full editor ("<review id>#<drink>"): its own slot, so New drink never opens it (Eddie, 29 Oct). */
  review?: string | null;
}

const MENU = '|menu:';
const NAME = '|name:';
const REVIEW = '|review:';

export function draftSlot(place: string, { menuSectionId, name, from, review }: SlotStart): string {
  const named = name?.trim().toLowerCase();
  return [place, menuSectionId ? `${MENU}${menuSectionId}` : '', from ? `|from:${from}` : '', review ? `${REVIEW}${review}` : '', named ? `${NAME}${named}` : ''].join('');
}

/** An import review's drink: it waits in the review, not in New's Drafts or the account. */
export const isReviewSlot = (slot: string) => {
  // Before the name, which is free text and could hold anything.
  const at = slot.indexOf(NAME);
  return (at >= 0 ? slot.slice(0, at) : slot).includes(REVIEW);
};

/** A review's drink slots at a place, to let go once the review is done. */
export const reviewSlots = (kept: Record<string, unknown>, place: string, review: string) => Object.keys(kept).filter((slot) => slot.startsWith(`${place}${REVIEW}${review}#`));

/** A slot for a drink by name that doesn't take over a draft already kept by that name. */
export function freeNameSlot(kept: Record<string, unknown>, place: string, name: string): string | undefined {
  return [name, `${name} (imported)`].map((n) => draftSlot(place, { name: n })).find((s) => !kept[s]);
}

/**
 * Drafts an import put in a place's plain New drink slot (before 29 Oct an
 * import's Edit opened there, so New drink kept opening the import), moved
 * to a draft of their own by name. Only an import's draft has a `start`.
 */
export function importsInPlainSlots<K extends { draft: { name: string }; start?: unknown }>(kept: Record<string, K>): { from: string; to: string }[] {
  return Object.entries(kept)
    .filter(([slot, k]) => !slot.includes('|') && k.start)
    // A draft by that name already: this one is told apart as the import's.
    .map(([slot, k]) => ({ from: slot, to: freeNameSlot(kept, slot, k.draft.name.trim() || 'Imported drink') }))
    .filter((m): m is { from: string; to: string } => !!m.to);
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

/**
 * What a slot was opened with, so New's Drafts can open it again
 * (make-anything-steps-1, step 1): the place ('home' or a venue's id), and
 * the menu section, drink and name it was started from.
 */
export function slotStart(slot: string): SlotStart & { place: string } {
  // The name comes last and is as typed ("gin | tonic"): everything after its key.
  const at = slot.indexOf(NAME);
  const name = at >= 0 ? slot.slice(at + NAME.length) : null;
  const [place, ...rest] = (at >= 0 ? slot.slice(0, at) : slot).split('|');
  const part = (key: string) => rest.find((r) => r.startsWith(`${key}:`))?.slice(key.length + 1) ?? null;
  return { place, menuSectionId: part('menu'), from: part('from'), review: part('review'), name };
}
