import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, PressableScale, useDs, type IconName } from '@/components/ds';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useActiveVenue, type Venue } from '@/hooks/useActiveVenue';
import { useItemLocations, useWaitingForSpot } from '@/hooks/useBackBar';
import { useCollection } from '@/hooks/useCollection';
import { useBarDrinks, useShelf } from '@/hooks/useHomeBar';
import { useVenueMenus } from '@/hooks/useMenus';
import { useMode } from '@/hooks/useMode';
import { useBarWeek, useWeekStart } from '@/hooks/useWeek';
import { groupMenus } from '@/lib/menus';
import { roleLabel } from '@/lib/roles';
import { backBarLine, collectionLine, menusLine, shelfLine } from '@/lib/shellNav';
import { weekLine } from '@/lib/week';

import { RoundPlacesNote, RoundSheetBlock } from '@/components/screens/firstRound/RoundElsewhere';
import { useFirstRound } from '@/hooks/useFirstRound';

import { MENUS_PLACE, useNavPlaces, type Place } from './navPlaces';
import { TeamCard, useOpenTeam } from './TeamCard';
import { HomeMark, useSwitchTo, VenueMark } from './VenueMarks';

function SwitchRow({ mark, name, detail, selected, onPress }: { mark: React.ReactNode; name: string; detail: string; selected: boolean; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="radio" aria-checked={selected} accessibilityLabel={`${name}, ${detail}`} onPress={onPress} style={[styles.switchRow, { borderBottomColor: ds.c.line }]}>
      {mark}
      <View style={styles.rowText}>
        <Body style={styles.strong}>{name}</Body>
        <Caption tone="muted">{detail}</Caption>
      </View>
      {selected ? <IconSymbol name="checkmark" size={18} color={ds.accentText} /> : null}
    </PressableScale>
  );
}

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

// The switcher draws Settings as a sun and Menus as a document (nav-switcher); the sidebar keeps its own.
const SETTINGS: Place = { key: 'settings', label: 'Settings', icon: 'place.settings', path: '/settings' };

/** The venue's own lines under each place: live counts where the app already has them. */
function useVenueLines(venue: Venue): Record<string, string> {
  const [now] = useState(() => Date.now());
  const menus = groupMenus((useVenueMenus(venue.id).data ?? []).filter((m) => m.barId === venue.id), now);
  const placed = useItemLocations(venue.id).data?.length ?? 0;
  const { waiting } = useWaitingForSpot(venue.id);
  const week = useBarWeek(venue.id).data;
  const from = useWeekStart();
  return {
    menus: menusLine(menus.on, menus.draft.length),
    'back-bar': backBarLine(placed, waiting.length),
    brand: 'Logo, colours and type',
    roles: 'Who sees what, by role',
    'venue-settings': 'Hours, address, units',
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

function VenuePlaces({ venue, onGo }: { venue: Venue; onGo: (p: Place) => void }) {
  const { work, venuePlaces, week } = useNavPlaces();
  // My team leads the sheet as its own card (TeamCard), so it isn't listed again here.
  const rest = venuePlaces.filter((p) => p.key !== 'team');
  // Menus waits for its step in the first round, like its tab.
  const menus = useFirstRound().hidden.includes('menus') ? [] : [MENUS_PLACE];
  return <Places places={[...menus, ...work, ...rest, ...(week ? [week] : []), SETTINGS]} lines={useVenueLines(venue)} onGo={onGo} />;
}

function HomePlaces({ onGo }: { onGo: (p: Place) => void }) {
  // My Bar, Collection, You and Settings, as decided on the canvas (10 Oct): the home tabs past Discover.
  const { tabs: all } = useNavPlaces();
  const tabs = all.filter((t) => t.key !== 'discover');
  return <Places places={[...tabs, SETTINGS]} lines={useHomeLines()} onGo={onGo} />;
}

/**
 * The venue menu, opened from the logo on phones and the tablet rail. At a
 * venue it's titled with the venue and your role and opens on My team
 * (nav-switcher-team: Eddie couldn't find it on iOS), then the switch rows,
 * then the venue's other places (Menus, Back bar, Brand, Venue settings, This
 * week, Settings). At home: the switch rows, then My Bar, Collection, You and
 * Settings. Everything the desktop sidebar has, in one sheet.
 */
export function VenueMenuSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { venues, active } = useActiveVenue();
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
    <MenuSheet visible onClose={onClose} title={venue ? venue.name : 'Switch to'} subtitle={venue ? roleLabel(venue.roleLevel) : undefined} plain>
      {venue ? (
        <>
          {inRound ? <RoundSheetBlock onClose={onClose} /> : <TeamCard barId={venue.id} onGo={openTeam} />}
          <DsText variant="caption" tone="muted" role="heading" style={styles.heading}>
            Switch to
          </DsText>
        </>
      ) : null}
      <View role="radiogroup" accessibilityLabel="Switch to">
        <SwitchRow mark={<HomeMark size={40} />} name="Home bar" detail="Your shelf and collection" selected={home} onPress={() => choose('home')} />
        {venues.map((v) => (
          <SwitchRow key={v.id} mark={<VenueMark venue={v} size={40} />} name={v.name} detail={roleLabel(v.roleLevel)} selected={!home && v.id === active?.id} onPress={() => choose(v)} />
        ))}
      </View>
      <DsText variant="caption" tone="muted" role="heading" style={styles.heading}>
        {venue ? `More at ${venue.name}` : 'At home'}
      </DsText>
      <View role="navigation" accessibilityLabel={venue ? `More at ${venue.name}` : 'At home'}>
        {venue ? <VenuePlaces venue={venue} onGo={go} /> : <HomePlaces onGo={go} />}
      </View>
      {venue ? <RoundPlacesNote /> : null}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  // Hairlines between rows and a chevron on each place, as the board draws them.
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, borderBottomWidth: StyleSheet.hairlineWidth },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth },
  // The last place ends the sheet: no hairline under it.
  last: { borderBottomWidth: 0 },
  tile: { width: 36, height: 36, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  heading: { fontFamily: fontFamilies.mono, textTransform: 'uppercase', marginTop: space.lg, marginBottom: space.xs },
});
