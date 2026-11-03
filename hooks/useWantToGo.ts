import { getLocales } from 'expo-localization';
import { useState, useSyncExternalStore } from 'react';

import { useCollection } from '@/hooks/useCollection';
import { useVenueScores } from '@/hooks/useDiscover';
import { useLovedBars, useWantBars, type KeptBar, type LovedBar } from '@/hooks/useKept';
import { useMyHadDrinks } from '@/hooks/useRankings';
import { hoursStatus } from '@/lib/barHours';
import { barNews } from '@/lib/collectionMenus';
import { beenBars, hoursText, lovedLine, type WantBar } from '@/lib/collectionStages';
import { distanceKm } from '@/lib/discoverDrinks';
import { formatDistance, usesMiles } from '@/lib/nearMe';
import { RELEASES_SHOWN } from '@/lib/releases';
import { useLastPlace } from '@/store/useLastPlace';

/** Why a bar is on your list: the drinks you saved from it, else what it's pouring now. */
function whyLine(bar: KeptBar, saved: number): string | null {
  if (saved) return `You saved ${saved === 1 ? 'a drink' : `${saved} drinks`} from here`;
  return bar.currentMenu ? `${bar.currentMenu.name} on now` : null;
}

/**
 * Want to go (board home-collection-bars): the bars you want to go to
 * (want_list) and haven't had a drink at yet, each with how far (from where near me last found you),
 * tonight's hours, why it's here and everyone's score. Your bars lists them;
 * Discover's map pins them (/discover?list=want).
 */
export function useWantToGo(): { want: WantBar[]; isLoading: boolean; error: Error | null } {
  const { data: wanted = [], isLoading, error } = useWantBars();
  const hadQuery = useMyHadDrinks();
  const had = hadQuery.data ?? [];
  const saved = useCollection().data?.drinks ?? [];
  const place = useLastPlace((s) => s.place);
  // The last place comes back from storage after the first render on native; distances wait for it.
  const placeReady = useSyncExternalStore(useLastPlace.persist.onFinishHydration, useLastPlace.persist.hasHydrated, useLastPlace.persist.hasHydrated);
  const [now] = useState(() => Date.now());
  const beenIds = new Set(beenBars(had, 'score').map((b) => b.venue.id));
  // Done is read, never stored: a bar you've had a drink at is Been.
  const bars = wanted.filter((b) => !beenIds.has(b.id));
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
  // Loading until the bars you've been to and where you were are known: before that, Want to go holds the wrong bars and no distances.
  return { want, isLoading: isLoading || hadQuery.isLoading || !placeReady, error };
}

export interface LovedRow {
  bar: LovedBar;
  /** "Where you work", "Winter menu is on · 0.5 mi", "Open until 4 · 1.1 mi". */
  line: string | null;
}

/** Your bars' Loved list (Kept-you-bars): each bar with what's new there and how far. `workIds`: bars you're on the team of. */
export function useLovedRows(workIds: ReadonlySet<string>): { rows: LovedRow[]; isLoading: boolean; error: Error | null } {
  const { data: loved = [], isLoading, error } = useLovedBars();
  const place = useLastPlace((s) => s.place);
  const [now] = useState(() => Date.now());
  const miles = usesMiles(getLocales()[0]);
  const rows = loved.map((bar) => {
    const at = bar.latitude != null && bar.longitude != null ? { latitude: bar.latitude, longitude: bar.longitude } : null;
    const status = hoursStatus(bar.hours, new Date(now), bar.timezone);
    return {
      bar,
      line: lovedLine({
        work: workIds.has(bar.id),
        news: barNews(bar.currentMenu, RELEASES_SHOWN && bar.latestRelease ? { name: bar.latestRelease.name, date: bar.latestRelease.date } : null)?.text ?? null,
        hours: status ? { open: status.open, text: hoursText(status) } : null,
        away: place && at ? formatDistance(distanceKm(place, at), miles) : null,
      }),
    };
  });
  return { rows, isLoading, error };
}
