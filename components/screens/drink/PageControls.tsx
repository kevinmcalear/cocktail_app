import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { DsText, GlassButton, useDs, useGutter } from '@/components/ds';
import { displayFaces, layout, space, type BackbarScheme } from '@/constants/tokens';

/** How long Back runs: its circle, or the pill with where it goes (desktop board's measure). */
export const backWidth = (label?: string) => (label ? Math.round(46 + label.length * 8.2) : layout.minTapTarget);

/** Room for whatever sits on the bar's right: round buttons, and Edit's wider pill. */
export function barRoom({ save, onShare, onEdit, more }: Pick<PageControlsProps, 'save' | 'onShare' | 'onEdit' | 'more'>) {
  return [save, onShare, more].filter(Boolean).length * (layout.minTapTarget + space.sm) + (onEdit ? EDIT_PILL + space.sm : 0);
}

/** The small title once the big one (a display line, about 64) has gone under the bar. */
export function useSmallTitle(scrollY: SharedValue<number>, tuck: number) {
  return useAnimatedStyle(() => ({ opacity: interpolate(scrollY.get(), [tuck + space.xl, tuck + space.xxxl + space.sm], [0, 1], 'clamp') }));
}

/** The page's ground fading in behind the bar, solid by the time the first line reaches it. */
export function BarBacking({ height, scrollY, tuck }: { height: number; scrollY: SharedValue<number>; tuck: number }) {
  const ds = useDs();
  const backing = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.get(), [tuck - space.xxxl, tuck], [0, 1], 'clamp') }));
  return <Animated.View style={[styles.backing, { height, backgroundColor: ds.c.ground, borderBottomColor: ds.c.line }, backing]} />;
}

interface PageControlsProps {
  /** The glass's scheme. Left out: the page's own (a photo page already takes the photo's). */
  over?: BackbarScheme;
  top: number;
  scrollY: SharedValue<number>;
  /** The scroll offset where the page's first line reaches the bar: the backing is solid by then, the small title follows. */
  tuck: number;
  /** Where the small title starts instead, when the big one is in the photo and leaves sooner. */
  smallAt?: number;
  /** The small title in the bar. */
  title: string;
  /** Room on the title's left: a docked drawing sits there. */
  titleInset?: number;
  /** Beside a list, or at the root of nothing: no Back. */
  noBack?: boolean;
  /** A pointer has room for a label (desktop board: "Back says where it goes"). */
  backLabel?: string;
  /** To make, for people who don't make it at a bar (Kevin, 29 Oct: Save and Share as toolbar icons). */
  save?: { saved: boolean; onToggle: () => void; label: [string, string]; icon?: 'bookmark' | 'heart' } | null;
  onShare?: () => void;
  /** Drink Creator and Admin: Edit, the one labelled control. */
  onEdit?: () => void;
  editLabel?: string;
  /** Report and Fix as admin (DrinkMoreMenu), when there's either. */
  more?: ReactNode;
  /** Between the bar's backing and the buttons: the docked drawing. */
  children?: ReactNode;
}

/**
 * The drink and item pages' top bar (boards Draw-scroll, Photo-scroll): glass
 * Back on the left, Share and Edit on the right. As the big title passes
 * under it, a backing in the page's ground fades in and the small title with
 * it. Nothing else: no study pile, no role switcher, no More. The web and a
 * wide iPad draw it here; phones have the same in the system's bar (ItemHeader).
 */
export function PageControls({ over, top, scrollY, tuck, smallAt = tuck, title, titleInset = 0, noBack, backLabel, save, onShare, onEdit, editLabel = 'Edit', more, children }: PageControlsProps) {
  const ds = useDs();
  const router = useRouter();
  const gutter = useGutter();
  const barHeight = top + space.sm * 2 + layout.minTapTarget;
  const small = useSmallTitle(scrollY, smallAt);
  const back = noBack ? (
    <View />
  ) : (
    <GlassButton
      accessibilityLabel={backLabel && backLabel !== 'Back' ? `Back to ${backLabel}` : 'Back'}
      icon="chevron.left"
      label={backLabel}
      scheme={over}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
  return (
    <>
      <BarBacking height={barHeight} scrollY={scrollY} tuck={tuck} />
      {children}
      <Animated.View style={[styles.title, { top: top + space.sm, height: layout.minTapTarget, left: gutter + backWidth(backLabel) + space.sm + titleInset, right: gutter + barRoom({ save, onShare, onEdit, more }) }, small]} aria-hidden>
        <DsText variant="headline" numberOfLines={1} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
          {title}
        </DsText>
      </Animated.View>
      <View style={[styles.row, { top: top + space.sm, left: gutter, right: gutter }]}>
        {back}
        <View style={styles.right}>
          {save ? (
            <GlassButton
              accessibilityLabel={save.label[save.saved ? 1 : 0]}
              icon={save.icon === 'heart' ? (save.saved ? 'heart.fill' : 'heart') : save.saved ? 'bookmark.fill' : 'bookmark'}
              scheme={over}
              onPress={save.onToggle}
            />
          ) : null}
          {onShare ? <GlassButton accessibilityLabel="Share" icon="square.and.arrow.up" scheme={over} onPress={onShare} /> : null}
          {onEdit ? <GlassButton accessibilityLabel={editLabel} label="Edit" scheme={over} onPress={onEdit} /> : null}
          {more}
        </View>
      </View>
    </>
  );
}

/** About the width of the labelled Edit pill. */
const EDIT_PILL = 72;

const styles = StyleSheet.create({
  backing: { position: 'absolute', top: 0, left: 0, right: 0, borderBottomWidth: StyleSheet.hairlineWidth, pointerEvents: 'none' },
  title: { position: 'absolute', justifyContent: 'center', pointerEvents: 'none' },
  row: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  right: { flexDirection: 'row', gap: space.sm },
});
