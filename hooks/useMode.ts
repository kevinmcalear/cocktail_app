import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useAppMode, useAppModeHydrated, type AppMode } from '@/store/useAppMode';

/**
 * The mode the app is in. People without a venue are always at home; people
 * with one start in venue mode until they switch in the venue chip.
 *
 * Until auth and the venues load, it's the mode this device last settled on,
 * so a home bartender's launch doesn't open venue tabs first. `ready` is false
 * only on native, before that's known (a first launch, or the moment storage
 * is read): the tabs wait rather than mount the wrong set. Web always renders
 * (its static HTML can't wait on storage), guessing venue as before.
 */
export function useMode(): { mode: AppMode; setMode: (mode: AppMode) => void; isLoading: boolean; ready: boolean } {
  const { venues, isLoading } = useActiveVenue();
  const picked = useAppMode((s) => s.mode);
  const known = useAppMode((s) => s.known);
  const hydrated = useAppModeHydrated();
  const setMode = useAppMode((s) => s.setMode);
  const settled: AppMode | null = isLoading ? null : venues.length === 0 ? 'home' : (picked ?? 'venue');
  const guess = hydrated ? known : null;

  useEffect(() => {
    if (settled && hydrated && settled !== useAppMode.getState().known) useAppMode.getState().setKnown(settled);
  }, [settled, hydrated]);

  return {
    mode: settled ?? guess ?? 'venue',
    setMode,
    isLoading,
    ready: Platform.OS === 'web' || settled !== null || guess !== null,
  };
}
