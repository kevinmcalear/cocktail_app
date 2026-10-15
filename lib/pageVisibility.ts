/**
 * Who sees a bar's page (bars.page_visibility, copied to the bar's profile).
 * An unclaimed bar is 'description' (Menu). The database keeps the specs back
 * (public.is_spec_locked, app_recipe_presentation); this is the copy and the
 * page-level rule the app shows.
 */

export type PageVisibility = 'locked' | 'description' | 'open';

export const PAGE_VISIBILITIES: PageVisibility[] = ['locked', 'description', 'open'];

/**
 * What each setting shows people outside the venue, and what a guest will see.
 * The labels are the ladder's names (Names, Menu, Open); the stored values keep
 * their old names so nothing in the database moves.
 */
export const PAGE_COPY: Record<PageVisibility, { label: string; detail: string; preview: string }> = {
  locked: {
    label: 'Names',
    detail: 'Your bar, awards, people, menus and drink names. No photos, descriptions or specs.',
    preview: 'Your bar, awards and team, your menus, and the names of your drinks. No photos, descriptions or specs.',
  },
  description: {
    label: 'Menu',
    detail: 'Adds each drink’s photo, description and ingredients, without amounts. Amounts and methods stay private.',
    preview: 'Every drink with its photo, what it tastes like, who made it and what goes in it, without amounts. Amounts and methods stay with you.',
  },
  open: {
    label: 'Open',
    detail: 'Full specs for drinks you mark shareable. Good for classics and old menus.',
    preview: 'Everything above, plus full specs for the drinks you share.',
  },
};

/**
 * Whether a bar's page keeps its drinks' specs from this viewer. A person's
 * page (null) never does, and the bar's own team always sees everything.
 */
export function pageLocksSpecs(visibility: PageVisibility | null | undefined, onTeam: boolean): boolean {
  return !!visibility && visibility !== 'open' && !onTeam;
}

/** Whether descriptions show: only a locked page hides them. */
export const pageShowsDescriptions = (visibility: PageVisibility | null | undefined) => visibility !== 'locked';

/** The note under a locked spec, for one drink or a bar's page of them. */
export function specLockNote(bar: string, unclaimed: boolean, one: boolean): string {
  if (unclaimed) {
    return one
      ? `You can rank and save this drink. Its spec shows once ${bar} claims its page and chooses to share it.`
      : `You can rank and save these drinks. Specs show once ${bar} claims this page and chooses to share them.`;
  }
  return one ? `You can rank and save this drink. ${bar} keeps its spec to its team.` : `You can rank and save these drinks. ${bar} keeps its specs to its team.`;
}
