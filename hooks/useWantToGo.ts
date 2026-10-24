import { getLocales } from 'expo-localization';
import { useState } from 'react';

import { useCollection } from '@/hooks/useCollection';
import { useVenueScores } from '@/hooks/useDiscover';
import { useLovedBars, type LovedBar } from '@/hooks/useKept';
import { useMyHadDrinks } from '@/hooks/useRankings';
import { hoursStatus } from '@/lib/barHours';
import { beenBars, type WantBar } from '@/lib/collectionStages';
import { distanceKm } from '@/lib/discoverDrinks';
import { formatDistance, usesMiles } from '@/lib/nearMe';
import { useLastPlace } from '@/store/useLastPlace';

/** Why a bar is on your list: the drinks you saved from it, else what it's pouring now. */
function whyLine(bar: LovedBar, saved: number): string | null {
  if (saved) return `You saved ${saved === 1 ? 'a drink' : `${saved} drinks`} from here`;
  return bar.currentMenu ? `${bar.currentMenu.name} on now` : null;
}

/** "Open until 1am", "Opens 5pm Thu", "Closed". */
function hoursText(s: { open: boolean; detail: string | null }): string {
  if (s.open) return s.detail ? `Open ${s.detail}` : 'Open now';
  return s.detail ? s.detail.charAt(0).toUpperCase() + s.detail.slice(1) : 'Closed';
}

/**
 * Want to go (board home-collection-bars): the bars you love and haven't had
 * a drink at yet, each with how far (from where near me last found you),
 * tonight's hours, why it's here and everyone's score. Collection's Bars
 * lists them; Discover's map pins them (/discover?list=want).
 */
export function useWantToGo(): { want: WantBar[]; isLoading: boolean; error: Error | null } {
  const { data: loved = [], isLoading, error } = useLovedBars();
  const had = useMyHadDrinks().data ?? [];
  const saved = useCollection().data?.drinks ?? [];
  const place = useLastPlace((s) => s.place);
  const [now] = useState(() => Date.now());
  const beenIds = new Set(beenBars(had, 'score').map((b) => b.venue.id));
  const bars = loved.filter((b) => !beenIds.has(b.id));
  const scores = useVenueScores(bars.map((b) => b.id));
  const miles = usesMiles(getLocales()[0]);
  const want = bars.map((b): WantBar => {
    const at = b.latitude != null && b.longitude != null ? { latitude: b.latitude, longitude: b.longitude } : null;
    const km = place && at ? distanceKm(place, at) : null;
    const status = hoursStatus(b.hours, new Date(now), b.timezone);
    return {
      id: b.id,
      handle: b.handle,
      name: b.name,
      avatarUrl: b.avatarUrl,
      place: b.place,
      latitude: at?.latitude ?? null,
      longitude: at?.longitude ?? null,
      km,
      away: km !== null ? formatDistance(km, miles) : null,
      hours: status ? { open: status.open, text: hoursText(status) } : null,
      // A classic's barName is whoever publishes it, not a drink saved from this bar.
      why: whyLine(b, saved.filter((d) => !d.classic && d.barName === b.name).length),
      everyone: scores.get(b.id) ?? null,
    };
  });
  return { want, isLoading, error };
}
