import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, PressableScale, useDs, type IconName } from '@/components/ds';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useActiveVenue, type Venue } from '@/hooks/useActiveVenue';
import { useItemLocations, useWaitingForSpot } from '@/hooks/useBackBar';
import { useBarMembers } from '@/hooks/useBarDetail';
import { useBarInvites } from '@/hooks/useBarInvites';
import { useCollection } from '@/hooks/useCollection';
import { useShelf } from '@/hooks/useHomeBar';
import { useVenueMenus } from '@/hooks/useMenus';
import { useMode } from '@/hooks/useMode';
import { useEffectiveRole } from '@/hooks/useViewAs';
import { groupMenus } from '@/lib/menus';
import { roleLabel } from '@/lib/roles';
import { backBarLine, collectionLine, menusLine, shelfLine, teamLine } from '@/lib/shellNav';
import { canManageTeam } from '@/lib/team';

import { useNavPlaces, type Place } from './navPlaces';
import { HomeMark, useSwitchTo, VenueMark } from './VenueMarks';

function SwitchRow({ mark, name, detail, selected, onPress }: { mark: React.ReactNode; name: string; detail: string; selected: boolean; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="radio" aria-checked={selected} accessibilityLabel={`${name}, ${detail}`} onPress={onPress} style={styles.switchRow}>
      {mark}
      <View style={styles.rowText}>
        <Body style={styles.strong}>{name}</Body>
        <Caption tone="muted">{detail}</Caption>
      </View>
      {selected ? <IconSymbol name="checkmark" size={18} color={ds.accentText} /> : null}
    </PressableScale>
  );
}

function PlaceRow({ icon, label, detail, onPress }: { icon: IconName; label: string; detail: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="link" accessibilityLabel={`${label}. ${detail}`} onPress={onPress} style={styles.placeRow}>
      <View style={[styles.tile, { backgroundColor: ds.c.raised }]}>
        <IconSymbol name={icon} size={18} color={ds.c.ink} />
      </View>
      <View style={styles.rowText}>
        <Body style={styles.strong}>{label}</Body>
        <Caption tone="muted">{detail}</Caption>
      </View>
    </PressableScale>
  );
}

const SETTINGS: Place = { key: 'settings', label: 'Settings', icon: 'gearshape', path: '/settings' };

/** The venue's own lines under each place: live counts where the app already has them. */
function useVenueLines(venue: Venue): Record<string, string> {
  const role = useEffectiveRole(venue.id);
  const [now] = useState(() => Date.now());
  const menus = groupMenus((useVenueMenus(venue.id).data ?? []).filter((m) => m.barId === venue.id), now);
  const placed = useItemLocations(venue.id).data?.length ?? 0;
  const { waiting } = useWaitingForSpot(venue.id);
  const members = useBarMembers(venue.id).data;
  const invites = useBarInvites(venue.id, canManageTeam(role)).data ?? [];
  return {
    menus: menusLine(menus.on, menus.draft.length),
    'back-bar': backBarLine(placed, waiting.length),
    team: members ? teamLine(members.length, invites.length) : 'Who’s on the team',
    brand: 'Logo, colours and type',
    'venue-settings': 'Hours, address, units',
    settings: 'Your account and the app',
  };
}

function useHomeLines(): Record<string, string> {
  const bottles = useShelf().data?.length ?? 0;
  const toMake = useCollection().data?.drinks.length ?? 0;
  const menus = (useVenueMenus(null).data ?? []).filter((m) => !m.barId).length;
  return {
    bar: shelfLine(bottles),
    collection: collectionLine(toMake, menus),
    profile: 'Your profile, ranks and taste',
    settings: 'Your account and the app',
  };
}

function Places({ places, lines, onGo }: { places: Place[]; lines: Record<string, string>; onGo: (p: Place) => void }) {
  return places.map((p) => <PlaceRow key={p.key} icon={p.icon} label={p.label} detail={lines[p.key] ?? ''} onPress={() => onGo(p)} />);
}

function VenuePlaces({ venue, onGo }: { venue: Venue; onGo: (p: Place) => void }) {
  const { work, venuePlaces } = useNavPlaces();
  return <Places places={[...work, ...venuePlaces, SETTINGS]} lines={useVenueLines(venue)} onGo={onGo} />;
}

function HomePlaces({ onGo }: { onGo: (p: Place) => void }) {
  // My Bar, Collection and You: the home tabs past Discover, which the tab bar already shows.
  const tabs = useNavPlaces().tabs.filter((t) => t.key !== 'discover');
  return <Places places={[...tabs, SETTINGS]} lines={useHomeLines()} onGo={onGo} />;
}

/**
 * The venue menu, opened from the logo on phones and the tablet rail: switch
 * to home or another venue, then this venue's places (Menus, Back bar, My
 * team, Brand, Venue settings, Settings), or at home My Bar, Collection, You
 * and Settings. Everything the desktop sidebar has, in one sheet.
 */
export function VenueMenuSheet({ onClose }: { onClose: () => void }) {
  const ds = useDs();
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
  return (
    <MenuSheet visible onClose={onClose} title="Switch to">
      <View role="radiogroup" accessibilityLabel="Switch to" style={[styles.group, { borderBottomColor: ds.c.line }]}>
        <SwitchRow mark={<HomeMark size={40} />} name="Home bar" detail="Your shelf and collection" selected={home} onPress={() => choose('home')} />
        {venues.map((v) => (
          <SwitchRow key={v.id} mark={<VenueMark venue={v} size={40} />} name={v.name} detail={roleLabel(v.roleLevel)} selected={!home && v.id === active?.id} onPress={() => choose(v)} />
        ))}
      </View>
      <DsText variant="caption" tone="muted" role="heading" style={styles.heading}>
        {venue ? `At ${venue.name}` : 'At home'}
      </DsText>
      <View role="navigation" accessibilityLabel={venue ? `At ${venue.name}` : 'At home'}>
        {venue ? <VenuePlaces venue={venue} onGo={go} /> : <HomePlaces onGo={go} />}
      </View>
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  group: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: space.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56 },
  tile: { width: 36, height: 36, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  heading: { fontFamily: fontFamilies.mono, textTransform: 'uppercase', marginTop: space.lg, marginBottom: space.xs },
});
