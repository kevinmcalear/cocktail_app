import { useRouter, type Href } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, DsText, PopoverMenu, PressableScale, useDs, usePopover, type IconName } from '@/components/ds';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useActiveVenue, type Venue } from '@/hooks/useActiveVenue';
import { useItemLocations, useWaitingForSpot } from '@/hooks/useBackBar';
import { useCollection } from '@/hooks/useCollection';
import { useShelf } from '@/hooks/useHomeBar';
import { useVenueMenus } from '@/hooks/useMenus';
import { useMode } from '@/hooks/useMode';
import { useVenueFeatures } from '@/hooks/useVenueFeatures';
import { useVenueSetup } from '@/store/useVenueSetup';
import { startedSetup } from '@/lib/venueSetup';
import { useBarWeek, useWeekStart } from '@/hooks/useWeek';
import { groupMenus } from '@/lib/menus';
import { roleLabel } from '@/lib/roles';
import { backBarLine, collectionLine, featuresLine, menusLine, shelfLine, teamLine } from '@/lib/shellNav';
import { VENUE_FEATURES } from '@/lib/venueFeatures';
import { weekCount } from '@/lib/week';

import { RoundPlacesNote, RoundSheetBlock } from '@/components/screens/firstRound/RoundElsewhere';
import { useFirstRound } from '@/hooks/useFirstRound';

import { MENUS_PLACE, useNavPlaces, type Place } from './navPlaces';
import { useTeamCard } from './TeamCard';
import { HomeMark, useSwitchTo, VenueMark } from './VenueMarks';

/** One row of a group: the icon in the venue's accent, the name, a short live count, a chevron. */
function PlaceRow({ icon, label, value, first, onPress }: { icon: IconName; label: string; value: string; first: boolean; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="link" accessibilityLabel={value ? `${label}. ${value}` : label} onPress={onPress} style={styles.row}>
      <IconSymbol name={icon} size={20} color={ds.accentText} />
      {/* The hairline starts after the icon, as grouped lists draw it. */}
      <View style={[styles.rowBody, !first && { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
        <Body numberOfLines={1} style={styles.label}>
          {label}
        </Body>
        {value ? (
          <Body tone="muted" numberOfLines={1}>
            {value}
          </Body>
        ) : null}
        <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
      </View>
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

/** The short live count on the right of each place at a venue; places with nothing to count show none. */
function useVenueValues(venue: Venue): Record<string, string> {
  const [now] = useState(() => Date.now());
  const menus = groupMenus((useVenueMenus(venue.id).data ?? []).filter((m) => m.barId === venue.id), now);
  const placed = useItemLocations(venue.id).data?.length ?? 0;
  const { waiting } = useWaitingForSpot(venue.id);
  const week = useBarWeek(venue.id).data;
  const from = useWeekStart();
  const on = useVenueFeatures().on.length;
  const team = useTeamCard(venue.id);
  return {
    menus: menusLine(menus.on.length, menus.draft.length),
    'back-bar': backBarLine(placed, waiting.length),
    week: weekCount(week ?? [], from),
    team: team.alone ? 'Invite' : team.members ? teamLine(team.members.length, 0) : '',
    features: featuresLine(on, VENUE_FEATURES.length),
  };
}

function useHomeValues(): Record<string, string> {
  const bottles = useShelf().data?.length ?? 0;
  const toMake = useCollection().data?.drinks.length ?? 0;
  return { bar: shelfLine(bottles), collection: collectionLine(toMake) };
}

/** One rounded group of places under its heading, as iOS Settings and Material lists draw a section. */
function Group({ heading, places, values, onGo, label }: { heading?: string; places: Place[]; values: Record<string, string>; onGo: (p: Place) => void; label: string }) {
  const ds = useDs();
  if (!places.length) return null;
  return (
    <View style={heading ? styles.section : undefined}>
      {heading ? (
        <DsText variant="caption" tone="muted" role="heading" style={styles.heading}>
          {heading}
        </DsText>
      ) : null}
      <View role="navigation" accessibilityLabel={label} style={[styles.group, { backgroundColor: ds.c.raised }]}>
        {places.map((p, i) => (
          <PlaceRow key={p.key} icon={p.icon} label={p.label} value={values[p.key] ?? ''} first={i === 0} onPress={() => onGo(p)} />
        ))}
      </View>
    </View>
  );
}

/**
 * At a venue: its working pages (Menus, Back bar, This week), then Venue,
 * in the desktop sidebar's order (My team, Features, Brand, Roles and
 * access, Venue settings), then You (Settings). An Admin alone on the team
 * gets Invite on My team, which opens its invite sheet.
 */
function VenuePlaces({ venue, onGo }: { venue: Venue; onGo: (p: Place) => void }) {
  const { work, venuePlaces, week } = useNavPlaces();
  const round = useFirstRound();
  const values = useVenueValues(venue);
  // Menus waits for its step in the first round, like its tab.
  const menus = round.hidden.includes('menus') ? [] : [MENUS_PLACE];
  const working = [...menus, ...work, ...(week ? [week] : [])];
  const setup = venuePlaces.map((p) => (p.key === 'team' && values.team === 'Invite' ? { ...p, path: '/team?invite=1' } : p));
  return (
    <>
      <Group places={working} values={values} onGo={onGo} label={`At ${venue.name}`} />
      <Group heading="Venue" places={setup} values={values} onGo={onGo} label="Venue" />
      <Group heading="You" places={[SETTINGS]} values={values} onGo={onGo} label="You" />
    </>
  );
}

/**
 * "Run a bar? Set it up" at the end of the home menu, for anyone not on a
 * venue's team (Q35b and Q36 A, approved 26 Oct 2026): venue setup at Find
 * your bar, where they claim theirs or add a new one, or where a setup
 * already started stopped. Once they're on a team, Switch takes its place.
 */
const SET_UP: Place = { key: 'set-up', label: 'Run a bar? Set it up', icon: 'building.2', path: '/venue-setup?step=find' };

function HomePlaces({ onGo, setUp }: { onGo: (p: Place) => void; setUp: boolean }) {
  const started = startedSetup(useVenueSetup((s) => s.runs));
  // My Bar, Collection and You, as decided on the canvas (10 Oct): the home tabs past Discover.
  const { tabs: all } = useNavPlaces();
  const tabs = all.filter((t) => t.key !== 'discover');
  const values = useHomeValues();
  return (
    <>
      <Group places={tabs} values={values} onGo={onGo} label="At home" />
      <Group heading="You" places={[SETTINGS]} values={values} onGo={onGo} label="You" />
      {setUp ? <Group heading="A bar of your own" places={[started ? { ...SET_UP, path: started } : SET_UP]} values={values} onGo={onGo} label="A bar of your own" /> : null}
    </>
  );
}

/**
 * The venue menu, opened from the logo on phones, the tablet rail and the
 * desktop sidebar. Titled with where you are (the venue and your role, or
 * Home bar) with Switch beside the X for anyone with a venue, then that place's pages: at a venue
 * its working pages, Venue and You; at home My Bar, Collection, You and
 * Settings (venue-menu proposal A, approved 24 Oct 2026), and with no venue,
 * Run a bar? Set it up (Q35b).
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
          <VenuePlaces venue={venue} onGo={go} />
          <RoundPlacesNote />
        </>
      ) : (
        <HomePlaces onGo={go} setUp={!isLoading && !venues.length} />
      )}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  group: { borderRadius: radius.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: space.lg },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52, paddingRight: space.md },
  label: { flex: 1 },
  medium: { fontFamily: fontFamilies.bodyMedium },
  // The body's own gap plus this sets each section apart; its heading sits close to its group.
  section: { gap: space.sm, marginTop: space.sm },
  heading: { fontFamily: fontFamilies.bodyMedium, marginLeft: space.xs },
  switch: { flexDirection: 'row', alignItems: 'center', gap: space.xs, height: 32, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
});
