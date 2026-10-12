import { useEffect, type ReactNode } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Button, Caption, Chip, sheetIsDialog, SheetScrollView, Title, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { dragShade, STRETCH } from '@/components/ds/sheetDrag';
import { SheetScrollContext, slideAway, useSheetDrag } from '@/components/ds/useSheetDrag';
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
 * near the top on wide screens (like ⌘K), and never a bottom sheet on the web.
 * It sits inside the screen rather than in a Modal, so a result can open its
 * page on top and coming back finds it as it was. Android back, Escape on the web, and the scrim close it.
 * As a bottom sheet it drags down to close like the app's Sheet (useSheetDrag).
 */
export function DiscoverOverlay({ label, onClose, full, action, head, footer, children }: DiscoverOverlayProps) {
  const ds = useDs();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const bottom = useTabBarInset();
  const wide = useBreakpoint() !== 'phone';
  const page = full && !wide;
  const card = wide || (sheetIsDialog && !page);
  const sheet = !card && !page;
  const { height: windowHeight } = useWindowDimensions();
  const drag = useSharedValue(0);
  const close = (velocity: number) => {
    'worklet';
    slideAway(drag, windowHeight, velocity, (finished) => {
      'worklet';
      if (finished) scheduleOnRN(onClose);
    });
  };
  const { height, pan, scroll } = useSheetDrag({ drag, enabled: sheet, onClose: close });
  const scrimStyle = useAnimatedStyle(() => ({ opacity: dragShade(drag.get(), height.get()) }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: drag.get() }] }));

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

  const frame = card
    ? [styles.card, !wide && styles.narrowCard, { borderColor: ds.c.line, backgroundColor: ds.c.ground }]
    : page
      ? [styles.flex, { paddingTop: insets.top + space.lg, backgroundColor: ds.c.ground }]
      : [styles.sheet, { marginTop: insets.top + space.xxxl, borderColor: ds.c.line, backgroundColor: ds.c.surface }];
  return (
    <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={[StyleSheet.absoluteFill, styles.layer]}>
      {page ? null : (
        <Animated.View style={[StyleSheet.absoluteFill, scrimStyle]}>
          <Pressable accessibilityLabel="Close" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: ds.c.scrim }]} />
        </Animated.View>
      )}
      {/* Below the screen's edge: what shows when the sheet is pulled up past the top. */}
      {sheet ? <Animated.View style={[styles.stretch, { backgroundColor: ds.c.surface }, sheetStyle]} /> : null}
      <GestureDetector gesture={pan}>
        <Animated.View role="dialog" aria-modal aria-label={label} style={[frame, sheetStyle]} onLayout={(e) => height.set(e.nativeEvent.layout.height)}>
          {sheet ? <View style={[styles.grabber, { backgroundColor: ds.c.lineStrong }]} /> : null}
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
          <SheetScrollContext value={scroll}>
            <SheetScrollView
              keyboardShouldPersistTaps="handled"
              style={card ? styles.shrink : styles.flex}
              contentContainerStyle={[styles.gap, { paddingHorizontal: gutter, paddingBottom: footer ? space.lg : card ? space.xl : bottom }]}
            >
              {children}
            </SheetScrollView>
          </SheetScrollContext>
          {footer ? <View style={{ paddingHorizontal: gutter, paddingBottom: card ? space.lg : bottom }}>{footer}</View> : null}
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const NOTES = NOTE_KINDS.map((d) => ({ id: noteKind(d), label: noteWord(d) }));
const GROUPS = [
  { title: 'Style', items: STYLES },
  { title: 'Spirit', items: SPIRITS },
  { title: 'Tastes', items: NOTES },
] as const;

interface FiltersSheetProps {
  kinds: readonly string[];
  onChange: (kinds: string[]) => void;
  /** Bars with matching drinks, null while loading. */
  bars: number | null;
  /** Closed bars in the area, and whether they're shown. */
  closed: { count: number; shown: boolean; onShow: (on: boolean) => void };
  onClose: () => void;
}

/** Styles, spirits and tastes, several at once, and closed bars. The list and map behind update as you tap. */
export function FiltersSheet({ kinds, onChange, bars, closed, onClose }: FiltersSheetProps) {
  const toggle = (id: string) => onChange(kinds.includes(id) ? kinds.filter((k) => k !== id) : [...kinds, id]);
  return (
    <DiscoverOverlay
      label="Filters"
      onClose={onClose}
      action={<Button label="Clear" variant="ghost" onPress={() => (onChange([]), closed.onShow(false))} />}
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
      <View style={styles.group}>
        <Caption tone="muted">History</Caption>
        <View style={styles.chips}>
          <Chip multi quiet label={closed.count ? `Closed bars · ${closed.count}` : 'Closed bars'} selected={closed.shown} onPress={() => closed.onShow(!closed.shown)} />
        </View>
        <Caption tone="muted">Bars that have shut, kept for their history. Search finds them either way.</Caption>
      </View>
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
  /** "This area": what the map shows; Discover searches it, or shows the map to move. */
  onThisArea: () => void;
  onClose: () => void;
}

/** What the Where sheet says about where Discover is looking (disc-where). */
function whereLine(area: Area, pinOn: boolean): string {
  const near = area.kind === 'point' && area.source === 'me' ? `Near you, within ${Math.round(area.radiusKm)} km.` : pinOn ? 'Near you.' : area.kind === 'city' ? `In ${area.label}.` : area.kind === 'anywhere' ? 'Anywhere.' : 'This area, as the map shows it.';
  return `${near} This area is what the map shows after you move it.`;
}

/** Where: near me, anywhere, the map's area (always offered), or a city with bars. */
export function AreaSheet({ area, near, preferNear, onArea, onNearMe, onThisArea, onClose }: AreaSheetProps) {
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
        <Chip label="This area" selected={area.kind === 'point' && area.source === 'map'} onPress={() => (onThisArea(), onClose())} />
      </View>
      <Caption tone="muted" role="status">
        {note ?? whereLine(area, pinOn)}
      </Caption>
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
  // Phone-width web: the card keeps a margin to the window's edges.
  narrowCard: { width: 'auto', alignSelf: 'stretch', marginHorizontal: space.lg },
  sheet: {
    flex: 1,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderCurve: 'continuous',
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  stretch: { position: 'absolute', left: 0, right: 0, bottom: -STRETCH, height: STRETCH },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: radius.pill, marginTop: space.md, marginBottom: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  gap: { gap: space.lg },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
