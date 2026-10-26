// Delete this bar (Eddie E53, board w3-delete-bar): the words for the two
// steps, the 7 days and the banner. The server schedules and runs the delete
// (supabase/migrations/20261121400000_delete_a_venue.sql); its header lists
// what goes and what stays, and these lists must say the same.

/** "Mon 2 Nov": the day a scheduled delete runs, or the day it was asked. */
export function deleteDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** The typed name matches the venue's: capitals and spaces at the ends don't matter, as delete_venue checks. */
export function nameMatches(typed: string, name: string): boolean {
  return typed.trim().toLowerCase() === name.trim().toLowerCase() && !!name.trim();
}

/** Step 1's "Goes" list. `people` is the venue's team, when it's known. */
export function whatGoes(name: string, people?: number): string[] {
  const lose = people ? `${people} ${people === 1 ? 'person loses' : 'people lose'} it` : 'everyone loses it';
  return [
    `${name} for your team: ${lose}, with its roles, invites and join requests`,
    'Its back bar, stock counts, kit, glassware and glass photos, suppliers and pricing',
    'Drinks and house-made recipes only the team could see, and drafts',
    'Menus that never started, run sheets, events and releases',
    'The pictures of all of that',
  ];
}

/** Step 1's "Stays on the public page" list. */
export function whatStays(name: string): string[] {
  return [
    `${name}’s public page, back to not claimed. Whoever runs it can claim it again.`,
    'Drinks guests can see, as descriptions without specs, with their credits and people’s rankings',
    'Past menus, in the page’s history, and people’s saved copies',
    `Awards, the people who worked here, and rankings at ${name}`,
  ];
}

export const STAYS_NOTE = 'A page set to Names only or Private loses its drinks too, with guests’ rankings of them.';

/** Who asked, for the banner and Venue settings: "You", their name, or "An Admin" once they've left the team. */
export function askedBy(requestedBy: string | null, meId: string | null, members: readonly { user_id: string; display_name?: string | null }[]): string {
  if (requestedBy && requestedBy === meId) return 'You';
  return members.find((m) => m.user_id === requestedBy)?.display_name || 'An Admin';
}

/** "any Admin (Rob too)": the venue's other Admins by first name, so the one asking knows who can undo it. */
export function otherAdmins(meId: string | null, members: readonly { user_id: string; display_name?: string | null; role_level: number }[]): string[] {
  return members.filter((m) => m.role_level >= 40 && m.user_id !== meId && m.display_name).map((m) => m.display_name!.split(' ')[0]);
}
