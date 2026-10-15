import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { holdUpdates, shouldCheck, shouldReload, updatesHeld } from '@/lib/otaUpdates';

/**
 * Gets a new over-the-air update running without two force-quits. On its own,
 * expo-updates downloads one at launch and runs it at the next cold start.
 * This also checks when the app comes back (at most every 30 minutes) and runs
 * a downloaded update as the app goes to the background, unless a screen
 * holds it (useHoldUpdates). Mounted once, in the root layout.
 */
export function useOtaUpdates() {
  const { isUpdatePending } = Updates.useUpdates();
  const pending = useRef(isUpdatePending);
  useEffect(() => {
    pending.current = isUpdatePending;
  }, [isUpdatePending]);

  useEffect(() => {
    // Off in development and Expo Go.
    if (!Updates.isEnabled) return;
    // expo-updates checked as the app launched.
    let lastCheck = Date.now();
    const sub = AppState.addEventListener('change', (next) => {
      if (shouldReload(next, pending.current, updatesHeld())) {
        Updates.reloadAsync().catch((e) => console.warn('Update reload failed', e));
        return;
      }
      if (next !== 'active' || !shouldCheck(Date.now(), lastCheck)) return;
      lastCheck = Date.now();
      // Downloading flips isUpdatePending, and the next trip to the background runs it.
      Updates.checkForUpdateAsync()
        .then(({ isAvailable }) => (isAvailable ? Updates.fetchUpdateAsync() : null))
        .catch((e) => console.warn('Update check failed', e));
    });
    return () => sub.remove();
  }, []);
}

/**
 * Keeps a downloaded update from reloading the app while this screen is open
 * (and `active`): a drink being edited or added, a prep being made.
 * ponytail: only those screens hold today. Other editors (beer, wine and
 * ingredient add, bar and menu editors) can lose their place to a reload in
 * the background; add a hold there if that bites.
 */
export function useHoldUpdates(active = true) {
  useEffect(() => (active ? holdUpdates() : undefined), [active]);
}
