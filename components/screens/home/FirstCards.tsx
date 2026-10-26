import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { Body, Button, GlassSurface, Headline, PopoverMenu, PressableScale, Surface, useDs, usePopover } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, displayName, layout, radius, space } from '@/constants/tokens';
import { useBarCities } from '@/hooks/useDiscover';
import type { NearMe } from '@/hooks/useNearMe';
import type { LocationAccess } from '@/lib/deviceLocation';
import { useFirstOpen } from '@/store/useFirstOpen';

import { placeSections, type PlaceProps } from './DiscoverPlace';
import { FavouritesSheet, useFavouritesAsk } from './FirstOpenSheet';

/**
 * Discover's first-open questions as cards, one at a time (w2-first-open, Kevin's
 * OK 26 Oct): first where to look (Q2), then, once there is an area, any
 * favourites (Q3). Nothing opens by itself. Phones: over the map under the
 * drink chips (`onGlass`); wide screens: at the top of the list.
 */
export function FirstCards({ near, access, where, onNearMe, onGlass }: { near: NearMe; access: LocationAccess | null; where: PlaceProps; onNearMe: () => void; onGlass: boolean }) {
  const location = useLocationCard(near, access);
  const favourites = useFavouritesAsk(where.area);
  const markAsked = useFirstOpen((s) => s.markAsked);
  const [picking, setPicking] = useState(false);
  // Gone (asked, or the area changed under it): a later card starts closed, never open by itself.
  if (picking && !favourites) setPicking(false);
  if (location) return <LocationCard state={location.state} where={where} onNearMe={onNearMe} onClose={location.close} onGlass={onGlass} />;
  if (!favourites) return null;
  return (
    <>
      <PromptCard title={`Any favourites ${favourites.where}?`} onClose={() => markAsked(favourites.userId)} closeLabel="Skip" onGlass={onGlass}>
        <Body tone="muted">Love the bars you go to and they lead Discover. Hide any you never want to see.</Body>
        <View style={styles.actions}>
          <Button dense style={styles.button} label="Pick favourites" icon="heart" onPress={() => setPicking(true)} />
        </View>
      </PromptCard>
      {picking ? <FavouritesSheet {...favourites} /> : null}
    </>
  );
}

type LocationState = 'ask' | 'blocked' | 'web-blocked';

/**
 * Whether the location card shows, and which. Not while location is allowed
 * (Discover finds the person quietly). Picking a city puts it away for good;
 * its X until Discover next opens. A "no" just given shows it again, blocked.
 */
function useLocationCard(near: NearMe, access: LocationAccess | null) {
  const cityPicked = useFirstOpen((s) => s.cityPicked);
  const [closed, setClosed] = useState(false);
  const [seen, setSeen] = useState(near);
  if (seen !== near) {
    setSeen(near);
    if (near.status === 'denied') setClosed(false);
  }
  const denied = near.status === 'denied';
  // A browser without the Permissions API says "ask" even after a no.
  const blocked = access === 'blocked' || (denied && Platform.OS === 'web');
  const state: LocationState | null = blocked ? (Platform.OS === 'web' ? 'web-blocked' : 'blocked') : access === 'ask' ? 'ask' : null;
  // While it asks, the note says "Finding where you are" in its place. Found is found, whatever a
  // browser's permission check says (Safari's allow-for-this-visit still answers "prompt").
  if (!state || closed || near.status === 'locating' || near.status === 'ready' || (cityPicked && !denied)) return null;
  return { state, close: () => setClosed(true) };
}

const LOCATION_COPY: Record<LocationState, { title: string; body: string }> = {
  ask: { title: 'See what’s being poured near you', body: 'Use your location to see the bars and drinks around you, best first. Or pick a city to look around.' },
  blocked: { title: 'Location is off for Cocktail', body: 'To see what’s near you, turn on Location for Cocktail in Settings. Or pick a city to look around.' },
  'web-blocked': {
    title: 'Location is off for this site',
    body: 'To see what’s near you, allow location for this site in your browser’s settings (Safari on iPhone: the aA button, then Website Settings, then Location). Or pick a city to look around.',
  },
};

function LocationCard({ state, where, onNearMe, onClose, onGlass }: { state: LocationState; where: PlaceProps; onNearMe: () => void; onClose: () => void; onGlass: boolean }) {
  const copy = LOCATION_COPY[state];
  return (
    <PromptCard title={copy.title} onClose={onClose} closeLabel="Not now" onGlass={onGlass}>
      <Body tone="muted">{copy.body}</Body>
      <View style={styles.actions}>
        {state === 'ask' ? <Button dense style={styles.button} label="Use my location" icon="location.fill" onPress={onNearMe} /> : null}
        {/* iOS and Android never ask twice: only Settings can turn it back on. */}
        {state === 'blocked' ? <Button dense style={styles.button} label="Open Settings" icon="gearshape" onPress={() => void Linking.openSettings()} /> : null}
        <PickCity where={where} primary={state === 'web-blocked'} />
      </View>
    </PromptCard>
  );
}

/** "Pick a city": the same places menu as the place token (DiscoverPlace.tsx), hung from this button. */
function PickCity({ where, primary }: { where: PlaceProps; primary: boolean }) {
  const menu = usePopover();
  const button = useRef<ComponentRef<typeof View>>(null);
  const { data: cities } = useBarCities();
  return (
    <View ref={button} collapsable={false}>
      <Button dense style={styles.button} label="Pick a city" icon="location" variant={primary ? 'primary' : 'secondary'} expanded={!!menu.anchor} onPress={() => menu.open(button.current)} />
      <PopoverMenu anchor={menu.anchor} label="Where to look" onClose={menu.close} sections={placeSections(where, cities ?? [])} />
    </View>
  );
}

/** A question on Discover: a display title, its words and actions, and an X. On glass over the map; a raised surface in a list. */
function PromptCard({ title, onClose, closeLabel, onGlass, children }: { title: string; onClose: () => void; closeLabel: string; onGlass: boolean; children: ReactNode }) {
  const ds = useDs();
  const body = (
    <View role="group" aria-label={title} style={styles.card}>
      <Headline role="heading" style={[styles.title, displayName.card, { fontFamily: displayFaces[ds.displayFace].regular }]}>
        {title}
      </Headline>
      {children}
      <PressableScale role="button" accessibilityLabel={closeLabel} onPress={onClose} style={styles.close}>
        <IconSymbol name="xmark" size={18} color={ds.c.muted} />
      </PressableScale>
    </View>
  );
  return onGlass ? <GlassSurface style={styles.glass}>{body}</GlassSurface> : <Surface raised style={styles.flush}>{body}</Surface>;
}

const styles = StyleSheet.create({
  glass: { borderRadius: radius.card },
  flush: { padding: 0 },
  card: { padding: space.lg, gap: space.sm },
  // Clear of the X.
  title: { paddingRight: layout.minTapTarget },
  // 16 a side, as the board draws them: both fit one row on a phone.
  button: { paddingHorizontal: space.lg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingTop: space.xs },
  close: { position: 'absolute', top: space.sm, right: space.sm, width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
});
