import { useLocalSearchParams, usePathname } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { areaStatus } from '@/components/screens/home/DiscoverArea';
import { useLocationAccess } from '@/hooks/useLocationAccess';
import { useNearMe, type NearMe } from '@/hooks/useNearMe';
import type { City } from '@/lib/discover';
import { distanceKm } from '@/lib/discoverDrinks';
import { nearMeArea, type Area } from '@/lib/nearMe';
import { useFirstOpen } from '@/store/useFirstOpen';
import { useLastPlace } from '@/store/useLastPlace';

const ANYWHERE: Area = { kind: 'anywhere' };

/** How far a fresh fix must be from the area's middle before near me moves: a walk, not GPS drift. */
const STAY_KM = 2;

/**
 * Discover's "where". It never asks for location by itself (Q2, 26 Oct): the
 * location card does (FirstCards.tsx). Already allowed, it opens near the
 * last place this device was found (store/useLastPlace.ts) at once, gets a
 * fresh position quietly, and moves only if that is more than STAY_KM away
 * (so the same query, and its cache, carry on). With no place yet it waits
 * for that (`locating`) rather than load every bar drink as a stand-in. Not
 * allowed, it shows anywhere until the person allows location or picks a place.
 */
export function useDiscoverArea() {
  const [area, setArea] = useState<Area>(() => {
    const last = useLastPlace.getState().place;
    return last ? nearMeArea(last) : ANYWHERE;
  });
  const [preferNear, setPreferNear] = useState(true);
  // Once the person picks a where, a late answer from the first ask doesn't move them.
  const touched = useRef(false);
  // Location not allowed: the last place this device was found isn't where Discover opens.
  const noLast = useRef(false);
  const { state: near, locate } = useNearMe();
  const clearPlace = useLastPlace((s) => s.clear);
  const place = useCallback(
    (found: NearMe) => {
      // No fresh fix (a timeout, no signal): near where this device was last is still near me.
      const last = found.status === 'unavailable' ? useLastPlace.getState().place : null;
      if (found.status === 'ready' || last) {
        setPreferNear(true);
        const next = nearMeArea(found.status === 'ready' ? found : last!);
        // A fresh fix a street or two from where Discover opened keeps the same results (and their cache).
        setArea((a) => (a.kind === 'point' && a.source === 'me' && distanceKm(a, next) < STAY_KM ? a : next));
        return;
      }
      // Location turned off: forget the last place too, and stop showing near it.
      if (found.status === 'denied') clearPlace();
      setPreferNear(false);
      setArea((a) => (a.kind === 'point' && a.source === 'me' ? ANYWHERE : a));
    },
    [clearPlace]
  );
  const markCityPicked = useFirstOpen((s) => s.markCityPicked);
  const onArea = (next: Area) => {
    touched.current = true;
    if (next.kind === 'city') markCityPicked();
    setPreferNear(next.kind === 'point' && next.source === 'me');
    setArea(next);
  };
  /** A city search named (its Places row): Discover goes there, as a map search would. */
  const onCity = (c: Pick<City, 'city' | 'country_code' | 'label'>) => onArea({ kind: 'city', city: c.city, country_code: c.country_code, label: c.label });
  // Search's Places rows elsewhere open Discover on the city (/discover?city=New%20York&cc=US), each new one once.
  const { city, cc } = useLocalSearchParams<{ city?: string; cc?: string }>();
  const linked = city && cc ? `${city}|${cc}` : null;
  const [opened, setOpened] = useState<string | null>(null);
  if (linked && linked !== opened && city && cc) {
    setOpened(linked);
    setPreferNear(false);
    setArea({ kind: 'city', city, country_code: cc, label: city });
  }
  const onNearMe = () => {
    touched.current = true;
    setPreferNear(true);
    void locate().then(place);
  };
  /** Going to the map from Anywhere: near me, as the map is about here. */
  const nearIfAnywhere = () => {
    if (area.kind === 'anywhere') onNearMe();
  };

  // Storage still loading when Discover opened: open near the last place once it's in.
  useEffect(
    () =>
      useLastPlace.persist.onFinishHydration(({ place: last }) => {
        if (!touched.current && !noLast.current && last) setArea((a) => (a.kind === 'anywhere' ? nearMeArea(last) : a));
      }),
    []
  );
  // Whether location is allowed, checked again after each answer and when the app comes back
  // to the front. Turned on in Settings: find the person now, no restart.
  // Only on the change to allowed, so a browser that says "allowed" but still refuses can't loop.
  const access = useLocationAccess(near.status);
  const wasAccess = useRef(access);
  useEffect(() => {
    const was = wasAccess.current;
    wasAccess.current = access;
    if (access === 'granted' && was !== null && was !== 'granted' && (near.status === 'denied' || near.status === 'idle')) void locate().then(place);
  }, [access, near.status, locate, place]);

  // Once Discover is on screen: allowed, find the person without a word; not, show anywhere and
  // leave the asking to the card. The tab mounts on its first focus (MountOnFocus), and this
  // guards anywhere else it's rendered off screen.
  const onScreen = usePathname() === '/discover';
  const asked = useRef(false);
  useEffect(() => {
    if (!onScreen || asked.current || access === null) return;
    asked.current = true;
    if (access === 'granted') {
      void locate().then((found) => {
        // A city link counts as a pick: the first answer doesn't move off it.
        if (!touched.current && !opened) place(found);
      });
      return;
    }
    // Not allowed: don't open near the last place once storage is in. Turned off since: forget it, as a
    // "no" does (after storage is in, or the stored place would come back over the clear).
    noLast.current = true;
    if (access === 'blocked') {
      if (useLastPlace.persist.hasHydrated()) clearPlace();
      else {
        const off = useLastPlace.persist.onFinishHydration(() => (clearPlace(), off()));
      }
    }
    if (touched.current) return;
    setPreferNear(false);
    setArea((a) => (a.kind === 'point' && a.source === 'me' ? ANYWHERE : a));
  }, [onScreen, access, locate, place, opened, clearPlace]);

  // Location gives up after 8 s (lib/deviceLocation.ts), so this wait has an end.
  const locating = area.kind === 'anywhere' && preferNear && (near.status === 'idle' || near.status === 'locating');
  // "Finding where you are" only while there's nothing to show yet; a refresh near the last place is quiet.
  const usingLast = near.status === 'unavailable' && area.kind === 'point' && area.source === 'me';
  const note = near.status === 'locating' && !locating ? null : areaStatus(near, usingLast);
  return { area, onArea, onCity, preferNear, near, access, onNearMe, nearIfAnywhere, locating, note };
}
