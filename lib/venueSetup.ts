/**
 * Venue setup (decision b03): an intro, finding the bar, five steps and a
 * summary. Someone finds their bar's page (or adds a new one), sets the venue
 * up, and proves it's theirs last (Eddie call, 22 Oct): every step before the
 * claim works without one. For an owner (owner-setup call 4) there's no role
 * step (they're the Admin, said in one line) and no Bring in (it moved to the
 * first menu). Checked by lib/venueSetup.check.ts.
 */

export const VENUE_STEPS = ['find', 'place', 'look', 'visibility', 'team', 'claim'] as const;
export type VenueStep = (typeof VENUE_STEPS)[number];
export type VenueScreen = 'intro' | VenueStep | 'done';

/** The five steps the rail and the bar count. Finding the bar comes before them, often in Setup or on the bar's page. */
export const RAIL_STEPS: readonly VenueStep[] = VENUE_STEPS.filter((s) => s !== 'find');

/** The rail's name for each step (owner-setup-path step 4). */
export const STEP_NAMES: Record<VenueStep, string> = {
  find: 'Find your bar',
  place: 'Where and when',
  look: 'How it looks',
  visibility: 'Who sees what',
  team: 'Your team',
  claim: 'Prove it’s yours',
};

/** The line under each step on the rail. */
export const STEP_LINES: Record<VenueStep, string> = {
  find: 'On Cocktail, or add it',
  place: 'Address, hours, contact',
  look: 'Logo, colours, menu type',
  visibility: 'Your page, menus, specs',
  team: 'Invite who works here',
  claim: 'Last: Instagram, a call or your website',
};

/** The screen after this one: intro, the steps in order, then the summary. */
export function nextScreen(at: VenueScreen): VenueScreen {
  if (at === 'intro') return 'find';
  if (at === 'done') return 'done';
  const i = VENUE_STEPS.indexOf(at);
  return VENUE_STEPS[i + 1] ?? 'done';
}

/** The screen before, for Back. The summary goes back to the last step. */
export function previousScreen(at: VenueScreen): VenueScreen {
  if (at === 'intro' || at === 'find') return 'intro';
  if (at === 'done') return VENUE_STEPS[VENUE_STEPS.length - 1];
  return VENUE_STEPS[VENUE_STEPS.indexOf(at) - 1];
}

/** "Step 1 of 5" with its bar; nothing on the intro, finding the bar or the summary. */
export function venueProgress(at: VenueScreen): { at: number; of: number; label: string; name: string } | null {
  const i = RAIL_STEPS.indexOf(at as VenueStep);
  if (i < 0) return null;
  return { at: i + 1, of: RAIL_STEPS.length, label: `Step ${i + 1} of ${RAIL_STEPS.length}`, name: 'Venue setup' };
}

/** Where a claim stands, as setup sees it. */
export type ClaimState = 'none' | 'pending' | 'approved';

/**
 * The first step not done yet, to pick setup up where it stopped. Kept
 * private for now, everything but the claim is done, so it opens the claim.
 */
export function resumeScreen(done: readonly string[]): VenueScreen {
  return VENUE_STEPS.find((s) => !done.includes(s)) ?? 'done';
}

type Runs = Record<string, { profileId?: string | null; done: readonly string[]; finished?: boolean } | undefined>;

/**
 * Which run setup works on and where it opens. ?bar= is that venue's run (at
 * the claim with &step=claim). ?claim= (a bar page's Claim, or Setup's owner
 * path) is that bar's run if one was started, else a fresh one with the bar
 * found: either way it opens at the first step not done, and the claim stays
 * last. With neither, a setup left before its venue was made picks up where
 * it stopped, else the intro.
 */
export function openRun(p: { bar?: string; claim?: string; step?: string }, runs: Runs): { key: string; screen: VenueScreen } {
  if (p.bar) return { key: p.bar, screen: p.step === 'claim' ? 'claim' : resumeScreen(runs[p.bar]?.done ?? []) };
  if (p.claim) {
    const key = Object.keys(runs).find((k) => runs[k]?.profileId === p.claim && !runs[k]?.finished) ?? 'new';
    const done = runs[key]?.profileId === p.claim ? (runs[key]?.done ?? []) : [];
    return { key, screen: resumeScreen(['find', ...done]) };
  }
  return { key: 'new', screen: runs.new?.done.length ? resumeScreen(runs.new.done) : 'intro' };
}

/**
 * The venue setup started on this device and not finished, for Settings ›
 * Create a venue (owner-setup call 5): it opens that one instead of making a
 * second bar. ponytail: device only (store/useVenueSetup); a bar started on
 * another device isn't found, and bars already made twice need the data fix.
 */
export function startedSetup(runs: Runs): string | null {
  const key = Object.keys(runs).find((k) => !runs[k]?.finished && (runs[k]?.done.length ?? 0) > 0);
  if (!key) return null;
  return key === 'new' ? '/venue-setup' : `/venue-setup?bar=${key}`;
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
