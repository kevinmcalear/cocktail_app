/**
 * Who still needs setup, and which step comes next. New accounts are marked
 * onboarded: false at sign-up; everyone else leaves the flag unset.
 * Checked by lib/onboarding.check.ts.
 */

import { handleFromName, profileDraftErrors } from '@/lib/profiles';

export type MeasureUnit = 'oz' | 'ml' | 'g';

/** The unit question: ounces, millilitres, grams. Centilitres stays in Settings. */
export const MEASURE_UNITS: { id: MeasureUnit; label: string }[] = [
  { id: 'oz', label: 'oz' },
  { id: 'ml', label: 'ml' },
  { id: 'g', label: 'g' },
];

export type OnboardingStep = 'name' | 'hospitality' | 'find' | 'work' | 'past' | 'menus' | 'drinks' | 'units';

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
 * Otherwise: current job, earlier jobs, menus, drinks, then units.
 */
export function nextStep(step: OnboardingStep, choice: StepChoice = 'no'): OnboardingStep | 'done' {
  if (step === 'name') return 'hospitality';
  if (step === 'hospitality') return choice === 'yes' ? 'find' : 'units';
  if (step === 'find') return choice === 'claim' ? 'units' : 'work';
  if (step === 'work') return 'past';
  if (step === 'past') return 'menus';
  if (step === 'menus') return 'drinks';
  if (step === 'drinks') return 'units';
  return 'done';
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
  return profileDraftErrors({ name: 'Name', handle, bio: '', instagram: '', isPublic: true }).handle;
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
