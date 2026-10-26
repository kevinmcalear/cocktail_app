import { useRouter, type Href } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, PopoverMenu, PressableScale, useDs, usePopover, type IconName } from '@/components/ds';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useActiveVenue, type Venue } from '@/hooks/useActiveVenue';
import { useItemLocations, useWaitingForSpot } from '@/hooks/useBackBar';
import { useCollection } from '@/hooks/useCollection';
import { useBarDrinks, useShelf } from '@/hooks/useHomeBar';
import { useVenueMenus } from '@/hooks/useMenus';
import { useMode } from '@/hooks/useMode';
import { useVenueFeatures } from '@/hooks/useVenueFeatures';
import { useBarWeek, useWeekStart } from '@/hooks/useWeek';
import { groupMenus } from '@/lib/menus';
import { roleLabel } from '@/lib/roles';
import { backBarLine, collectionLine, featuresLine, menusLine, shelfLine } from '@/lib/shellNav';
import { VENUE_FEATURES } from '@/lib/venueFeatures';
import { weekLine } from '@/lib/week';

import { RoundPlacesNote, RoundSheetBlock } from '@/components/screens/firstRound/RoundElsewhere';
import { useFirstRound } from '@/hooks/useFirstRound';

import { MENUS_PLACE, useNavPlaces, type Place } from './navPlaces';
import { TeamCard, useOpenTeam } from './TeamCard';
import { HomeMark, useSwitchTo, VenueMark } from './VenueMarks';

function PlaceRow({ icon, label, detail, last, onPress }: { icon: IconName; label: string; detail: string; last: boolean; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="link" accessibilityLabel={`${label}. ${detail}`} onPress={onPress} style={[styles.placeRow, { borderBottomColor: ds.c.line }, last && styles.last]}>
      <View style={[styles.tile, { backgroundColor: ds.c.raised }]}>
        <IconSymbol name={icon} size={18} color={ds.c.ink} />
      </View>
      <View style={styles.rowText}>
        <Body style={styles.strong}>{label}</Body>
        <Caption tone="muted">{detail}</Caption>
      </View>
      <IconSymbol name="chevron.right" size={18} color={ds.c.muted} />
    </PressableScale>
  );
}

/**
 * Switch, in the title row beside the X: a short menu of Home bar and your venues, the one
 * you're in checked. The sheet opens on where you are; switching is a tap
 * away, not the first screen (venue-menu proposal A, 24 Oct 2026).
 */
function SwitchButton({ home, active, onPick }: { home: boolean; active: Venue | null; onPick: (next: 'home' | Venue) => void }) {
  const ds = useDs();
  const { venues } = useActiveVenue();
  const menu = usePopover();
  const button = useRef<ComponentRef<typeof View>>(null);
  const items = [
    { label: 'Home bar', leading: <HomeMark size={28} />, checked: home, onPress: () => onPick('home') },
    ...venues.map((v) => ({ label: v.name, leading: <VenueMark venue={v} size={28} />, checked: !home && v.id === active?.id, onPress: () => onPick(v) })),
  ];
  return (
    <View ref={button} collapsable={false}>
      <PressableScale role="button" aria-expanded={!!menu.anchor} accessibilityLabel="Switch to Home bar or another venue" onPress={() => menu.open(button.current)} hitSlop={SLOP} style={[styles.switch, { backgroundColor: ds.c.raised, borderColor: ds.c.line }]}>
        <DsText variant="label" style={styles.medium}>
          Switch
        </DsText>
        <IconSymbol name="chevron.down" size={12} color={ds.c.muted} />
      </PressableScale>
      <PopoverMenu anchor={menu.anchor} label="Switch to" onClose={menu.close} sections={[{ items }]} />
    </View>
  );
}

// The pill is 32 tall; the slop makes it a full tap target.
const SLOP = (layout.minTapTarget - 32) / 2;

// Settings is the sliders and Menus the menu card, as everywhere else (nav-icons).
const SETTINGS: Place = { key: 'settings', label: 'Settings', icon: 'place.settings', path: '/settings' };

/** The venue's own lines under each place: live counts where the app already has them. */
function useVenueLines(venue: Venue): Record<string, string> {
  const [now] = useState(() => Date.now());
  const menus = groupMenus((useVenueMenus(venue.id).data ?? []).filter((m) => m.barId === venue.id), now);
  const placed = useItemLocations(venue.id).data?.length ?? 0;
  const { waiting } = useWaitingForSpot(venue.id);
  const week = useBarWeek(venue.id).data;
  const from = useWeekStart();
  const on = useVenueFeatures().on.length;
  return {
    menus: menusLine(menus.on, menus.draft.length),
    'back-bar': backBarLine(placed, waiting.length),
    features: featuresLine(on, VENUE_FEATURES.length),
    brand: 'Logo, colours and type',
    roles: 'Who sees what, by role',
    'venue-settings': 'Hours, address, units, staff link',
    week: week ? weekLine(week, from) : 'Events, menus going on, new drinks',
    settings: 'Your account and the app',
  };
}

function useHomeLines(): Record<string, string> {
  const bottles = useShelf().data?.length ?? 0;
  const ready = useBarDrinks().canMake.length;
  const toMake = useCollection().data?.drinks.length ?? 0;
  const menus = (useVenueMenus(null).data ?? []).filter((m) => !m.barId).length;
  return {
    bar: shelfLine(bottles, ready),
    collection: collectionLine(toMake, menus),
    profile: 'Your profile, ranks and taste',
    settings: 'Your account and the app',
  };
}

function Places({ places, lines, onGo }: { places: Place[]; lines: Record<string, string>; onGo: (p: Place) => void }) {
  return places.map((p, i) => <PlaceRow key={p.key} icon={p.icon} label={p.label} detail={lines[p.key] ?? ''} last={i === places.length - 1} onPress={() => onGo(p)} />);
}

function Heading({ children }: { children: string }) {
  return (
    <DsText variant="caption" tone="muted" role="heading" style={styles.heading}>
      {children}
    </DsText>
  );
}

/**
 * At a venue: its working pages (Menus, Back bar, This week), then Venue,
 * in the desktop sidebar's order (My team, Features, Brand, Roles and
 * access, Venue settings), then You (Settings).
 */
function VenuePlaces({ venue, onGo, onTeam }: { venue: Venue; onGo: (p: Place) => void; onTeam: (invite: boolean) => void }) {
  const { work, venuePlaces, week } = useNavPlaces();
  const round = useFirstRound();
  const lines = useVenueLines(venue);
  // Menus waits for its step in the first round, like its tab.
  const menus = round.hidden.includes('menus') ? [] : [MENUS_PLACE];
  const working = [...menus, ...work, ...(week ? [week] : [])];
  // My team leads Venue as its own card (TeamCard), so it isn't listed again.
  const setup = venuePlaces.filter((p) => p.key !== 'team');
  return (
    <>
      <View role="navigation" accessibilityLabel={`At ${venue.name}`}>
        <Places places={working} lines={lines} onGo={onGo} />
      </View>
      <Heading>Venue</Heading>
      <View role="navigation" accessibilityLabel="Venue" style={styles.venue}>
        {round.active ? null : <TeamCard barId={venue.id} onGo={onTeam} />}
        <View>
          <Places places={setup} lines={lines} onGo={onGo} />
        </View>
      </View>
      <Heading>You</Heading>
      <Places places={[SETTINGS]} lines={lines} onGo={onGo} />
    </>
  );
}

function HomePlaces({ onGo }: { onGo: (p: Place) => void }) {
  // My Bar, Collection and You, as decided on the canvas (10 Oct): the home tabs past Discover.
  const { tabs: all } = useNavPlaces();
  const tabs = all.filter((t) => t.key !== 'discover');
  const lines = useHomeLines();
  return (
    <>
      <View role="navigation" accessibilityLabel="At home">
        <Places places={tabs} lines={lines} onGo={onGo} />
      </View>
      <Heading>You</Heading>
      <Places places={[SETTINGS]} lines={lines} onGo={onGo} />
    </>
  );
}

/**
 * The venue menu, opened from the logo on phones, the tablet rail and the
 * desktop sidebar. Titled with where you are (the venue and your role, or
 * Home bar) with Switch beside the X for anyone with a venue, then that place's pages: at a venue
 * its working pages, Venue and You; at home My Bar, Collection, You and
 * Settings (venue-menu proposal A, approved 24 Oct 2026).
 */
export function VenueMenuSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { active, venues, isLoading } = useActiveVenue();
  const home = useMode().mode === 'home';
  const switchTo = useSwitchTo();
  const choose = (next: 'home' | Venue) => {
    onClose();
    switchTo(next);
  };
  const go = (p: Place) => {
    onClose();
    if (p.tab) router.navigate(p.path as Href);
    else router.push(p.path as Href);
  };
  const venue = home ? null : active;
  const openTeam = useOpenTeam(onClose);
  const inRound = useFirstRound().active;
  return (
    <MenuSheet
      visible
      onClose={onClose}
      title={venue ? venue.name : 'Home bar'}
      subtitle={venue ? roleLabel(venue.roleLevel) : 'Your shelf and collection'}
      leading={venue ? <VenueMark venue={venue} size={40} /> : <HomeMark size={40} />}
      // No venues, nowhere to switch to: no Switch (Q35a, 26 Oct 2026). Kept while they load, so it doesn't pop in.
      aside={isLoading || venues.length ? <SwitchButton home={home} active={active} onPick={choose} /> : undefined}
      plain
    >
      {venue ? (
        <>
          {inRound ? <RoundSheetBlock onClose={onClose} /> : null}
          <VenuePlaces venue={venue} onGo={go} onTeam={openTeam} />
          <RoundPlacesNote />
        </>
      ) : (
        <HomePlaces onGo={go} />
      )}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  // Hairlines between rows and a chevron on each place, as the board draws them.
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth },
  // The last place of a group ends it: no hairline under it.
  last: { borderBottomWidth: 0 },
  tile: { width: 36, height: 36, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  medium: { fontFamily: fontFamilies.bodyMedium },
  heading: { fontFamily: fontFamilies.mono, textTransform: 'uppercase', marginTop: space.lg, marginBottom: space.xs },
  venue: { gap: space.xs },
  switch: { flexDirection: 'row', alignItems: 'center', gap: space.xs, height: 32, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
});
