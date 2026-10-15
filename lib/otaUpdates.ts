import type { AppStateStatus } from 'react-native';

/** Coming back to the app asks EAS for a newer update at most this often. */
export const CHECK_EVERY_MS = 30 * 60_000;

export function shouldCheck(now: number, lastCheck: number) {
  return now - lastCheck >= CHECK_EVERY_MS;
}

// --- holds: screens mid-task, where a reload would drop the person's place ---

let holds = 0;

/** Holds a downloaded update back until the returned release is called (once). */
export function holdUpdates() {
  holds += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds -= 1;
  };
}

export function updatesHeld() {
  return holds > 0;
}

/**
 * A downloaded update runs as the app leaves the screen, so nobody sees it
 * reload, and never while a screen holds it. Otherwise it waits for the next
 * cold start, as expo-updates does on its own.
 */
export function shouldReload(next: AppStateStatus, pending: boolean, held: boolean) {
  return next === 'background' && pending && !held;
}
