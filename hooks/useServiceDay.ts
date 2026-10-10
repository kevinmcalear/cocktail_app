import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { msUntilTurnover, serviceDate } from '@/lib/serviceDay';

import { useIsHydrated } from './useIsHydrated';

const dayOfMonth = () => serviceDate(new Date()).getDate();

/**
 * The service day's day of the month (1 to 31), for the Tonight tab's
 * calendar: it turns over at 6am, not midnight (lib/serviceDay.ts). Updates at
 * 6am and whenever the app comes back to the front, since timers sleep in the
 * background. Null in web's static render and hydration, which have no clock.
 */
export function useServiceDay(): number | null {
  const hydrated = useIsHydrated();
  const [day, setDay] = useState(dayOfMonth);
  useEffect(() => {
    const refresh = () => setDay(dayOfMonth());
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
  return hydrated ? day : null;
}
