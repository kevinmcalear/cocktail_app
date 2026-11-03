import { useEffect, useSyncExternalStore } from 'react';

import { useAuth } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useBars } from '@/hooks/useBars';
import { useSettingsStore } from '@/store/useSettingsStore';

const onHydrated = (listener: () => void) => useSettingsStore.persist.onFinishHydration(listener);
const isHydrated = () => useSettingsStore.persist.hasHydrated();

/**
 * Keeps the settings store's barUnit on the unit of the bar you work at
 * (bars.spec_unit): your venue, or at home the one you'd go back to, so a
 * bartender's own drinks read in the bar's unit too. Signed out, or sure you
 * have no bar, none. Waits for the saved settings, and leaves the saved unit
 * alone while your bars aren't known (still loading, or a failed read). Its
 * own component, mounted once in the root layout, so getPreferredUnit reads
 * it outside React too and a venue switch doesn't redraw the root.
 */
export function BarUnitSync() {
  const hydrated = useSyncExternalStore(onHydrated, isHydrated, () => false);
  const { user, loading } = useAuth();
  const bars = useBars().data;
  const { active } = useActiveVenue();
  const known = hydrated && !loading && (!user || !!bars);
  const unit = !known ? undefined : !user || !active ? null : active.unit;
  useEffect(() => {
    const s = useSettingsStore.getState();
    if (unit !== undefined && (unit !== s.barUnit || !s.unitsChecked)) s.setBarUnit(unit);
  }, [unit]);
  return null;
}
