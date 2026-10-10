import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { msUntilTurnover, serviceDate } from '@/lib/serviceDay';

import { useIsHydrated } from './useIsHydrated';

const serviceTime = () => serviceDate(new Date()).getTime();

/**
 * The service day, at local midnight: it turns over at 6am, not midnight
 * (lib/serviceDay.ts), so Tonight's tab and its date always agree. Updates at
 * 6am and whenever the app comes back to the front, since timers sleep in the
 * background. Null in web's static render and hydration, which have no clock:
 * the build's date would differ from the device's and break hydration.
 */
export function useServiceDate(): Date | null {
  const hydrated = useIsHydrated();
  // A number, so a refresh on the same day doesn't re-render.
  const [time, setTime] = useState(serviceTime);
  useEffect(() => {
    const refresh = () => setTime(serviceTime());
    let timer: ReturnType<typeof setTimeout>;
    // A second past 6am, so the clock is surely over the line.
    const schedule = () => {
      timer = setTimeout(() => (refresh(), schedule()), msUntilTurnover(new Date()) + 1000);
    };
    schedule();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);
  return hydrated ? new Date(time) : null;
}

/** The service day's day of the month (1 to 31), for the Tonight tab's calendar. Null until hydrated on web. */
export function useServiceDay(): number | null {
  return useServiceDate()?.getDate() ?? null;
}
