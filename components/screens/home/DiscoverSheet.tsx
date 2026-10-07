import { useEffect, type ReactNode } from 'react';
import { BackHandler, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Caption, Chip, Title, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { radius, space } from '@/constants/tokens';
import { useBarCities } from '@/hooks/useDiscover';
import type { NearMe } from '@/hooks/useNearMe';
import { SPIRITS, STYLES } from '@/lib/drinkStyles';
import { NOTE_KINDS, noteKind, noteWord } from '@/lib/flavor';
import type { Area } from '@/lib/nearMe';

import { areaStatus } from './DiscoverArea';

interface DiscoverOverlayProps {
  /** Names the dialog. Shown as the heading unless `head` replaces the heading row. */
  label: string;
  onClose: () => void;
  /** Phones: the whole screen (search), else a sheet up from the bottom over a scrim (filters, where). */
  full?: boolean;
  /** Top right of the heading row; Done when not given. */
  action?: ReactNode;
  /** Replaces the heading row (the search field and its Done). */
  head?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * A sheet over Discover: the whole screen or a bottom sheet on phones, a card
 * near the top on wide screens (like ⌘K). It sits inside the screen rather
 * than in a Modal, so a result can open its page on top and coming back finds
 * it as it was. Android back, Escape on the web, and the scrim close it.
 */
export function DiscoverOverlay({ label, onClose, full, action, head, footer, children }: DiscoverOverlayProps) {
  const ds = useDs();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const bottom = useTabBarInset();
  const wide = useBreakpoint() !== 'phone';
  const page = full && !wide;

  useEffect(() => {
    if (Platform.OS === 'android') {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => (onClose(), true));
      return () => sub.remove();
    }
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const frame = wide
    ? [styles.card, { borderColor: ds.c.line, backgroundColor: ds.c.ground }]
    : page
      ? [styles.flex, { paddingTop: insets.top + space.lg, backgroundColor: ds.c.ground }]
      : [styles.sheet, { marginTop: insets.top + space.xxxl, borderColor: ds.c.line, backgroundColor: ds.c.surface }];
  return (
    <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={[StyleSheet.absoluteFill, styles.layer]}>
      {page ? null : <Pressable accessibilityLabel="Close" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: ds.c.scrim }]} />}
      <View role="dialog" aria-label={label} style={frame}>
        {wide || page ? null : <View style={[styles.grabber, { backgroundColor: ds.c.lineStrong }]} />}
        <View style={[styles.gap, { paddingHorizontal: gutter, paddingBottom: space.md }]}>
          {head ?? (
            <View style={styles.head}>
              <Title role="heading" style={styles.flex}>
                {label}
              </Title>
              {action ?? <Button label="Done" variant="ghost" onPress={onClose} />}
            </View>
          )}
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={wide ? styles.shrink : styles.flex}
          contentContainerStyle={[styles.gap, { paddingHorizontal: gutter, paddingBottom: footer ? space.lg : wide ? space.xl : bottom }]}
        >
          {children}
        </ScrollView>
        {footer ? <View style={{ paddingHorizontal: gutter, paddingBottom: wide ? space.lg : bottom }}>{footer}</View> : null}
      </View>
    </Animated.View>
  );
}

const NOTES = NOTE_KINDS.map((d) => ({ id: noteKind(d), label: noteWord(d) }));
const GROUPS = [
  { title: 'Style', items: STYLES },
  { title: 'Spirit', items: SPIRITS },
  { title: 'Tastes', items: NOTES },
] as const;

/** Styles, spirits and tastes, several at once. The list and map behind update as you tap. */
export function FiltersSheet({ kinds, onChange, bars, onClose }: { kinds: readonly string[]; onChange: (kinds: string[]) => void; bars: number | null; onClose: () => void }) {
  const toggle = (id: string) => onChange(kinds.includes(id) ? kinds.filter((k) => k !== id) : [...kinds, id]);
  return (
    <DiscoverOverlay
      label="Filters"
      onClose={onClose}
      action={<Button label="Clear" variant="ghost" onPress={() => onChange([])} />}
      footer={<Button label={bars === null ? 'Show bars' : `Show ${bars} ${bars === 1 ? 'bar' : 'bars'}`} onPress={onClose} />}
    >
      {GROUPS.map((g) => (
        <View key={g.title} style={styles.group}>
          <Caption tone="muted">{g.title}</Caption>
          <View role="group" accessibilityLabel={g.title} style={styles.chips}>
            {g.items.map((k) => (
              <Chip key={k.id} multi quiet label={k.label} selected={kinds.includes(k.id)} onPress={() => toggle(k.id)} />
            ))}
          </View>
        </View>
      ))}
      <Caption tone="muted">Drinks match any pick within a group and every group you pick from.</Caption>
    </DiscoverOverlay>
  );
}

const cityKey = (c: { city: string; country_code: string }) => `${c.city}|${c.country_code}`;

interface AreaSheetProps {
  area: Area;
  near: NearMe;
  preferNear: boolean;
  onArea: (area: Area) => void;
  onNearMe: () => void;
  onClose: () => void;
}

/** Where: near me, anywhere, the map's area, or a city with bars. */
export function AreaSheet({ area, near, preferNear, onArea, onNearMe, onClose }: AreaSheetProps) {
  const { data: cities } = useBarCities();
  const pinOn = (area.kind === 'point' && area.source === 'me') || (preferNear && area.kind === 'anywhere');
  const note = areaStatus(near);
  const pick = (next: Area) => {
    onArea(next);
    onClose();
  };
  return (
    <DiscoverOverlay label="Where" onClose={onClose}>
      <View role="radiogroup" accessibilityLabel="Where" style={styles.chips}>
        <Chip label="Near me" selected={pinOn} onPress={() => (onNearMe(), onClose())} />
        <Chip label="Anywhere" selected={area.kind === 'anywhere' && !pinOn} onPress={() => pick({ kind: 'anywhere' })} />
        {area.kind === 'point' && area.source === 'map' ? <Chip label="This area" selected onPress={onClose} /> : null}
      </View>
      {note ? <Caption tone="muted" role="status">{note}</Caption> : null}
      {cities?.length ? (
        <View style={styles.group}>
          <Caption tone="muted">Cities</Caption>
          <View role="radiogroup" accessibilityLabel="Cities" style={styles.chips}>
            {cities.map((c) => (
              <Chip
                key={cityKey(c)}
                quiet
                label={c.label}
                selected={area.kind === 'city' && cityKey(area) === cityKey(c)}
                onPress={() => pick({ kind: 'city', city: c.city, country_code: c.country_code, label: c.label })}
              />
            ))}
          </View>
        </View>
      ) : null}
    </DiscoverOverlay>
  );
}

const styles = StyleSheet.create({
  layer: { zIndex: 10 },
  flex: { flex: 1, minWidth: 0 },
  // The card has no height of its own, so its list shrinks to fit rather than filling it.
  shrink: { flexShrink: 1 },
  card: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 640,
    maxHeight: '80%',
    marginTop: '8%',
    paddingTop: space.lg,
    borderRadius: radius.sheet,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sheet: {
    flex: 1,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderCurve: 'continuous',
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: radius.pill, marginTop: space.md, marginBottom: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  gap: { gap: space.lg },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
