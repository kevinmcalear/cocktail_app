import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useAppMode, type AppMode } from '@/store/useAppMode';

/**
 * The mode the app is in. People without a venue are always at home; people
 * with one start in venue mode until they switch in the venue chip.
 */
export function useMode(): { mode: AppMode; setMode: (mode: AppMode) => void; isLoading: boolean } {
  const { venues, isLoading } = useActiveVenue();
  const stored = useAppMode((s) => s.mode);
  const setMode = useAppMode((s) => s.setMode);
  const mode: AppMode = !isLoading && venues.length === 0 ? 'home' : (stored ?? 'venue');
  return { mode, setMode, isLoading };
}
