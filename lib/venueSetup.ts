/**
 * Venue setup (decision b03): an intro, eight steps and a summary. Someone
 * finds their bar's page (or adds a new one), proves it's theirs, and sets
 * the venue up while a person checks the claim (b19). Checked by
 * lib/venueSetup.check.ts.
 */

export const VENUE_STEPS = ['find', 'claim', 'role', 'place', 'look', 'visibility', 'bring', 'team'] as const;
export type VenueStep = (typeof VENUE_STEPS)[number];
export type VenueScreen = 'intro' | VenueStep | 'done';

/** The rail's name for each step (canvas make-venue-desktop). */
export const STEP_NAMES: Record<VenueStep, string> = {
  find: 'Find your bar',
  claim: 'Prove it’s yours',
  role: 'Your role',
  place: 'Location and hours',
  look: 'Look',
  visibility: 'Who sees what',
  bring: 'Spec book and menu',
  team: 'Invite your team',
};

/** The screen after this one: intro, the eight steps in order, then the summary. */
export function nextScreen(at: VenueScreen): VenueScreen {
  if (at === 'intro') return 'find';
  if (at === 'done') return 'done';
  const i = VENUE_STEPS.indexOf(at);
  return VENUE_STEPS[i + 1] ?? 'done';
}

/** The screen before, for Back. The summary goes back to the last step. */
export function previousScreen(at: VenueScreen): VenueScreen {
  if (at === 'intro' || at === 'find') return 'intro';
  if (at === 'done') return 'team';
  return VENUE_STEPS[VENUE_STEPS.indexOf(at) - 1];
}

/** "Step 4 of 8" with its bar; nothing on the intro or the summary. */
export function venueProgress(at: VenueScreen): { at: number; of: number; label: string; name: string } | null {
  const i = VENUE_STEPS.indexOf(at as VenueStep);
  if (i < 0) return null;
  return { at: i + 1, of: VENUE_STEPS.length, label: `Step ${i + 1} of ${VENUE_STEPS.length}`, name: 'Venue setup' };
}

/** Where a claim stands, as setup sees it. */
export type ClaimState = 'none' | 'pending' | 'approved';

/**
 * The first step not done yet, to pick setup up from Tonight. A claim that's
 * waiting doesn't hold the rest up: that's the point of b19.
 */
export function resumeScreen(done: readonly VenueStep[]): VenueScreen {
  return VENUE_STEPS.find((s) => !done.includes(s)) ?? 'done';
}

/** What's still on its way, for Tonight's banner: the claim, invites nobody's taken up yet, a spec book to read. */
export function onItsWay(p: { claim: ClaimState; invites: number; waitingFiles: number }): number {
  return (p.claim === 'pending' ? 1 : 0) + (p.invites > 0 ? 1 : 0) + (p.waitingFiles > 0 ? 1 : 0);
}

/** "Sam, Mia and Tom": names in a sentence. */
export function namesLine(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The pinned button on the team step: "Send 3 invites", "Send the invite". */
export function sendInvitesLabel(count: number): string {
  if (count <= 1) return 'Send the invite';
  return `Send ${count} invites`;
}

/** A person to invite on the team step: an email is all it needs. */
export function inviteRowError(row: { email: string }): string | null {
  const email = row.email.trim();
  if (!email) return 'Add their email.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'That email doesn’t look right.';
  return null;
}

/** A website as typed, saved with its scheme so links work: "littlerye.com.au" → "https://littlerye.com.au". */
export function normalizeWebsite(typed: string): string | null {
  const t = typed.trim();
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}
