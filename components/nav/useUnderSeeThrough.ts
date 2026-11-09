/** Phones present the create wizards as modals, so the page under one never needs to show (useUnderSeeThrough.web.ts). */
export function useUnderSeeThrough(): boolean {
  return false;
}

/** Phones present the create wizards as modals, which keep what's under them out of reach on their own. */
export function useSeeThroughOpen(): boolean {
  return false;
}
