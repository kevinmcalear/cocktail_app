import { useRouter, type Href } from 'expo-router';
import { useRef, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, DsText, PressableScale, useDs } from '@/components/ds';
import { PopoverMenu, usePopover } from '@/components/ds/PopoverMenu';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, layout, radius, space } from '@/constants/tokens';
import { useMode } from '@/hooks/useMode';
import { roleLabel } from '@/lib/roles';

import { SETTINGS_PLACE, useSideNotes, useSidePlaces, type Place, type SideNotes } from './sidePlaces';
import { usePlaceSections } from './VenueMenu';
import { HomeMark, VenueMark } from './VenueMarks';

/** One row: the icon in the venue's accent, the name, the sidebar's note for it, a chevron. */
function PlaceRow({ place, value, warn, first, onPress }: { place: Place; value: string; warn?: boolean; first: boolean; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="link" accessibilityLabel={value ? `${place.label}. ${value}` : place.label} onPress={onPress} style={styles.row}>
      <IconSymbol name={place.icon} size={20} color={ds.accentText} />
      {/* The hairline starts after the icon, as grouped lists draw it. */}
      <View style={[styles.rowBody, !first && { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
        {/* The name never gives way to its note: a long menu name shortens instead. */}
        <Body numberOfLines={1} style={value ? styles.named : styles.label}>
          {place.label}
        </Body>
        {value ? (
          <Body tone={warn ? 'accent' : 'muted'} numberOfLines={1} style={styles.value}>
            {value}
          </Body>
        ) : null}
        <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
      </View>
    </PressableScale>
  );
}

/** One rounded group of places under its heading, as iOS Settings and Material lists draw a section. */
function Group({ heading, label, places, notes, onGo }: { heading?: string; label: string; places: Place[]; notes: SideNotes; onGo: (p: Place) => void }) {
  const ds = useDs();
  if (!places.length) return null;
  return (
    <View style={styles.section}>
      {heading ? (
        <DsText variant="caption" tone="muted" role="heading" style={styles.heading}>
          {heading}
        </DsText>
      ) : null}
      <View role="navigation" accessibilityLabel={label} style={[styles.group, { backgroundColor: ds.c.raised }]}>
        {places.map((p, i) => {
          const note = notes[p.key];
          // The sidebar names the menu on now in the row ("Autumn, on now"); here the row keeps its name and the note says it.
          const value = note ? (note.label ? `${note.label}, ${note.text}` : note.text) : '';
          return <PlaceRow key={p.key} place={p} value={value} warn={note?.warn} first={i === 0} onPress={() => onGo(p)} />;
        })}
      </View>
    </View>
  );
}

/** Switch, in the title row beside the X: the places menu (board C8), hung from the pill. A pick closes the sheet too. */
function SwitchButton({ onPicked }: { onPicked: () => void }) {
  const ds = useDs();
  const menu = usePopover();
  const button = useRef<ComponentRef<typeof View>>(null);
  const sections = usePlaceSections().map((s) => ({
    ...s,
    items: s.items.map((i) => ({
      ...i,
      onPress: () => {
        menu.close();
        onPicked();
        i.onPress();
      },
    })),
  }));
  return (
    <View ref={button} collapsable={false}>
      <PressableScale
        role="button"
        aria-expanded={!!menu.anchor}
        accessibilityLabel="Switch place"
        onPress={() => menu.open(button.current)}
        hitSlop={SLOP}
        style={[styles.switch, { backgroundColor: ds.c.raised, borderColor: ds.c.line }]}
      >
        <DsText variant="label" style={font.medium}>
          Switch
        </DsText>
        <IconSymbol name="chevron.down" size={12} color={ds.c.muted} />
      </PressableScale>
      <PopoverMenu anchor={menu.anchor} label="Your places" sections={sections} onClose={menu.close} />
    </View>
  );
}

// The pill is 32 tall; the slop makes it a full tap target.
const SLOP = (layout.minTapTarget - 32) / 2;

/**
 * The phone's place sheet, opened from the mark at the top left (board Prod-place, C8): titled with where you are
 * (the bar and your role, or Home) with Switch beside the X, then every page of that place from useSidePlaces, the
 * one list the desktop sidebar reads. At a bar: the sidebar's group (Menus, House-made, Team, Bar settings), then the
 * rest of its pages under More (Study, Back bar, Glassware, This week, Rota, Theme, Roles and access), each behind
 * its section switch and your capabilities; at home, Shelf and Menus. Settings last, under You.
 */
export function PlaceSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { mode, setMode } = useMode();
  const { venue: here, places, more } = useSidePlaces();
  const notes = useSideNotes(here?.id ?? null);
  const go = (p: Place) => {
    onClose();
    // As the sidebar does: Home's Menus is the menus page in home mode, and someone on no bar's team may still be in venue mode.
    if (p.key === 'home-menus' && mode !== 'home') setMode('home');
    if (p.tab) router.navigate(p.path as Href);
    else router.push(p.path as Href);
  };
  return (
    <MenuSheet
      visible
      onClose={onClose}
      title={here ? here.name : 'Home'}
      subtitle={here ? roleLabel(here.roleLevel) : 'Your shelf and menus'}
      leading={here ? <VenueMark venue={here} size={40} /> : <HomeMark size={40} />}
      aside={<SwitchButton onPicked={onClose} />}
      plain
    >
      <Group label={here ? `At ${here.name}` : 'At home'} places={places} notes={notes} onGo={go} />
      <Group heading="More" label={here ? `More at ${here.name}` : 'More'} places={more} notes={notes} onGo={go} />
      <Group heading="You" label="You" places={[SETTINGS_PLACE]} notes={notes} onGo={go} />
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  group: { borderRadius: radius.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: space.lg },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52, paddingRight: space.md },
  label: { flex: 1 },
  named: { flexShrink: 0 },
  value: { flex: 1, textAlign: 'right' },
  // Its heading sits close to its group.
  section: { gap: space.sm },
  heading: { ...font.medium, marginLeft: space.xs },
  switch: { flexDirection: 'row', alignItems: 'center', gap: space.xs, height: 32, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
});
