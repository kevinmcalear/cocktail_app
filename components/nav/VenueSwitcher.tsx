import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, PressableScale, Title, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { backbar, DEFAULT_ACCENT, fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useActiveVenue, type Venue } from '@/hooks/useActiveVenue';
import { useMode } from '@/hooks/useMode';
import { accentFill } from '@/lib/color';
import { roleLabel } from '@/lib/roles';

/** The venue's mark: its logo, or its initial on its own colour (not the active venue's). */
export function VenueMark({ venue, size = 28 }: { venue: Venue | null; size?: number }) {
  const own = accentFill(venue?.accent ?? DEFAULT_ACCENT, backbar.dark.ground, backbar.light.surface);
  const box = { width: size, height: size, borderRadius: size * 0.28 };
  if (venue?.logoUrl) {
    return <Image source={{ uri: venue.logoUrl }} style={box} contentFit="cover" accessibilityIgnoresInvertColors />;
  }
  return (
    <View style={[box, styles.initial, { backgroundColor: own.fill }]}>
      <DsText variant="headline" color={own.text} style={{ fontSize: size * 0.55, lineHeight: size * 0.7 }}>
        {(venue?.name ?? '·').charAt(0).toUpperCase()}
      </DsText>
    </View>
  );
}

/** Home mode's mark: a house on a plain tile. */
function HomeMark({ size = 28 }: { size?: number }) {
  const ds = useDs();
  return (
    <View style={[styles.initial, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: ds.c.raised }]}>
      <IconSymbol name="house.fill" size={size * 0.55} color={ds.c.ink} />
    </View>
  );
}

/**
 * The chip in the corner of every redesigned screen: which venue you're in,
 * or your home bar. Tapping it switches, like switching accounts.
 */
export function VenueSwitcher() {
  const ds = useDs();
  const router = useRouter();
  const { venues, active, setActive } = useActiveVenue();
  const { mode, setMode } = useMode();
  const [open, setOpen] = useState(false);
  const home = mode === 'home';
  const canSwitch = venues.length > 0;
  // Land on the first tab, since the other tabs change with the mode.
  const choose = (next: 'home' | Venue) => {
    if (next === 'home') setMode('home');
    else {
      setActive(next.id);
      setMode('venue');
    }
    setOpen(false);
    router.navigate('/');
  };
  const label = home ? 'Home bar' : (active?.name ?? 'No venue yet');
  return (
    <>
      <PressableScale
        onPress={() => canSwitch && setOpen(true)}
        disabled={!canSwitch}
        accessibilityLabel={`${home ? 'Home bar' : `Venue: ${label}`}${canSwitch ? '. Switch' : ''}`}
        style={styles.chip}
      >
        {home ? <HomeMark /> : <VenueMark venue={active} />}
        <DsText variant="headline" numberOfLines={1} style={styles.chipName}>
          {label}
        </DsText>
        {canSwitch ? <IconSymbol name="chevron.down" size={14} color={ds.c.muted} /> : null}
      </PressableScale>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityLabel="Close" style={[styles.scrim, { backgroundColor: ds.c.scrim }]} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: ds.c.surface }]} onPress={(e) => e.stopPropagation()}>
            <Title>Switch to</Title>
            <PressableScale
              role="radio"
              aria-selected={home}
              accessibilityLabel="Home bar, your shelf and collection"
              onPress={() => choose('home')}
              style={[styles.row, { borderBottomColor: ds.c.line }]}
            >
              <HomeMark size={40} />
              <View style={styles.rowText}>
                <Body style={{ fontFamily: fontFamilies.bodySemiBold }}>Home bar</Body>
                <Caption tone="muted">Your shelf and collection</Caption>
              </View>
              {home ? <IconSymbol name="checkmark" size={18} color={ds.accentText} /> : null}
            </PressableScale>
            {venues.map((v) => {
              const selected = !home && v.id === active?.id;
              return (
                <PressableScale
                  key={v.id}
                  role="radio"
                  aria-selected={selected}
                  accessibilityLabel={`${v.name}, ${roleLabel(v.roleLevel)}`}
                  onPress={() => choose(v)}
                  style={[styles.row, { borderBottomColor: ds.c.line }]}
                >
                  <VenueMark venue={v} size={40} />
                  <View style={styles.rowText}>
                    <Body style={{ fontFamily: fontFamilies.bodySemiBold }}>{v.name}</Body>
                    <Caption tone="muted">{roleLabel(v.roleLevel)}</Caption>
                  </View>
                  {selected ? <IconSymbol name="checkmark" size={18} color={ds.accentText} /> : null}
                </PressableScale>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget, flexShrink: 1 },
  chipName: { flexShrink: 1 },
  initial: { alignItems: 'center', justifyContent: 'center' },
  scrim: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: 520,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: space.xl,
    paddingBottom: space.xxxl,
    gap: space.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, borderBottomWidth: StyleSheet.hairlineWidth },
  rowText: { flex: 1, gap: 2 },
});
