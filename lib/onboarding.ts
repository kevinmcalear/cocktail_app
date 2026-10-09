/**
 * Who still needs setup, and which step comes next. New accounts are marked
 * onboarded: false at sign-up; everyone else leaves the flag unset.
 * Checked by lib/onboarding.check.ts.
 */

import { DEFAULT_IDENTITY, DEFAULT_SHARING, handleFromName, profileDraftErrors } from '@/lib/profiles';

export type MeasureUnit = 'oz' | 'ml' | 'g';

/** The unit question: ounces, millilitres, grams. Centilitres stays in Settings. */
export const MEASURE_UNITS: { id: MeasureUnit; label: string }[] = [
  { id: 'oz', label: 'oz' },
  { id: 'ml', label: 'ml' },
  { id: 'g', label: 'g' },
];

export type OnboardingStep = 'invite' | 'name' | 'hospitality' | 'find' | 'work' | 'past' | 'menus' | 'drinks' | 'taste' | 'units' | 'bring';

/** What the person picked on a step that branches. */
export type StepChoice = 'yes' | 'no' | 'claim' | 'new';

export type AuthTarget = '/auth/reset-password' | '/auth/login' | '/age-check' | '/onboarding' | '/(tabs)';

/** GoTrue may hand the flag back as a boolean or the string it stored. */
export function needsOnboarding(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  const flag = (metadata as { onboarded?: unknown }).onboarded;
  return flag === false || flag === 'false';
}

/** Where the age check sends someone once it's done or skipped. */
export function afterAgeCheck(metadata: unknown): '/onboarding' | '/(tabs)' {
  return needsOnboarding(metadata) ? '/onboarding' : '/(tabs)';
}

/**
 * The next screen. Hospitality looks for an existing profile first. A claim
 * skips the career steps (they don't own that profile until it's approved).
 * Otherwise: current job, earlier jobs, menus, drinks. Everyone then says what
 * they like to drink (their taste, see lib/flavor.ts) and picks units. Last,
 * the chance to bring a menu, specs or a shelf in (Bring in reads it after).
 * Someone who joined a venue from an invite takes the short way: name, units,
 * then the app (INVITE_STEPS). Their job at that venue is saved for them.
 */
export function nextStep(step: OnboardingStep, choice: StepChoice = 'no', joined = false): OnboardingStep | 'done' {
  if (joined) {
    const at = INVITE_STEPS.indexOf(step);
    if (at >= 0) return INVITE_STEPS[at + 1] ?? 'done';
  }
  if (step === 'invite') return 'name';
  if (step === 'name') return 'hospitality';
  if (step === 'hospitality') return choice === 'yes' ? 'find' : 'taste';
  if (step === 'find') return choice === 'claim' ? 'taste' : 'work';
  if (step === 'work') return 'past';
  if (step === 'past') return 'menus';
  if (step === 'menus') return 'drinks';
  if (step === 'drinks') return 'taste';
  if (step === 'taste') return 'units';
  if (step === 'units') return 'bring';
  return 'done';
}

/** The invited path after the welcome. Its third step is the app itself ("Have a look around"). */
export const INVITE_STEPS: OnboardingStep[] = ['name', 'units'];

/** The welcome's list of what's next. */
export const INVITE_STEP_NAMES = ['Check your name', 'Pick ml or oz', 'Have a look around'];

/** "Step 1 of 3" on the invited path, or null on any other step. */
export function inviteStepLabel(step: OnboardingStep): string | null {
  const at = INVITE_STEPS.indexOf(step);
  return at < 0 ? null : `Step ${at + 1} of ${INVITE_STEP_NAMES.length}`;
}

/**
 * The job title saved at the venue they joined: the role, when it reads as
 * one. Guest, Employee and Admin are access levels, not jobs. They can change
 * it on their profile.
 */
export function inviteJobTitle(roleLevel: number): string {
  if (roleLevel === 30) return 'Bartender';
  if (roleLevel === 35) return 'Drink Creator';
  return 'Team member';
}

/** "a Bartender", "an Admin": the welcome's "Join <bar> as …". */
export function withArticle(word: string): string {
  return `${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word}`;
}

/** A password for an account made from an invite (Auth's minimum is 6). */
export function passwordError(password: string): string | null {
  if (password.length < 6) return 'Use at least 6 characters.';
  return null;
}

/** "Attaboy, New York" and ", closed" when the bar has shut. Closed bars stay pickable. */
export function venueLabel(venue: { display_name: string; locality: string | null; is_closed?: boolean }): string {
  const name = venue.locality ? `${venue.display_name}, ${venue.locality}` : venue.display_name;
  return venue.is_closed ? `${name}, closed` : name;
}

/** "Jo Juniper" → the first and last name Settings already stores. */
export function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
}

/** What's wrong with the name, or null when it can be saved. */
export function nameError(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Add the name people will see.';
  if (trimmed.length > 80) return 'Keep your name to 80 characters.';
  if (!handleFromName(trimmed)) return 'Use a name with at least 3 letters.';
  return null;
}

/** The handle rule, once onboarding shows the field. */
export function handleError(handle: string): string | undefined {
  return profileDraftErrors({ name: 'Name', handle, bio: '', instagram: '', isPublic: true, ...DEFAULT_SHARING, ...DEFAULT_IDENTITY }).handle;
}

/** A job title for profile_positions (1 to 60 characters). */
export function roleError(role: string): string | null {
  const trimmed = role.trim();
  if (!trimmed) return 'Add your role, like Bartender.';
  if (trimmed.length > 60) return 'Keep your role to 60 characters.';
  return null;
}

export function barNameError(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Add the bar’s name.';
  if (trimmed.length > 80) return 'Keep the name to 80 characters.';
  return null;
}

/** A menu they worked on (1 to 120 characters, the profile_worked_menus check). */
export function menuNameError(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Add the menu’s name.';
  if (trimmed.length > 120) return 'Keep the menu name to 120 characters.';
  return null;
}

/** A cocktail they worked on. */
export function drinkNameError(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Add the cocktail’s name.';
  if (trimmed.length > 80) return 'Keep the name to 80 characters.';
  return null;
}

/** A year, or null when the field is empty. */
export function yearError(year: string): string | null {
  const trimmed = year.trim();
  if (!trimmed) return null;
  if (!/^\d{4}$/.test(trimmed) || Number(trimmed) < 1900 || Number(trimmed) > 2100) return 'Use a year from 1900 to 2100.';
  return null;
}

/**
 * Where a signed-in navigation should go, or null to stay. Public routes
 * (legal, venue links, gallery, published pages) are decided by the caller
 * before this. A new account does the age check first, then setup; opening
 * the app again before setup finishes comes back to it.
 */
export function authRedirect(input: {
  hasSession: boolean;
  inAuthGroup: boolean;
  authScreen: string | undefined;
  stayInAuth: boolean;
  passwordRecovery: boolean;
  segment: string | undefined;
  needsOnboarding: boolean;
}): AuthTarget | null {
  if (input.passwordRecovery && input.authScreen !== 'reset-password') return '/auth/reset-password';
  if (!input.hasSession && !input.inAuthGroup) return '/auth/login';
  if (input.hasSession && input.inAuthGroup && !input.stayInAuth) {
    if (input.authScreen === 'sign-up') return '/age-check';
    return input.needsOnboarding ? '/onboarding' : '/(tabs)';
  }
  if (
    input.hasSession &&
    input.needsOnboarding &&
    !input.inAuthGroup &&
    input.segment !== 'age-check' &&
    input.segment !== 'onboarding'
  ) {
    return '/onboarding';
  }
  return null;
}
