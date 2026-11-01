import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { DsText, GlassButton, useDs, useGutter } from '@/components/ds';
import { displayFaces, layout, space, type BackbarScheme } from '@/constants/tokens';

interface PageControlsProps {
  /** The glass's scheme. Left out: the page's own (a photo page already takes the photo's). */
  over?: BackbarScheme;
  top: number;
  scrollY: SharedValue<number>;
  /** The scroll offset where the page's first line reaches the bar: the backing is solid by then, the small title follows. */
  tuck: number;
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
 * it. Nothing else: no study pile, no role switcher, no More.
 */
export function PageControls({ over, top, scrollY, tuck, title, titleInset = 0, noBack, backLabel, save, onShare, onEdit, editLabel = 'Edit', more, children }: PageControlsProps) {
  const ds = useDs();
  const router = useRouter();
  const gutter = useGutter();
  const barHeight = top + space.sm * 2 + layout.minTapTarget;
  // Room for whatever sits on the right: round buttons, and Edit's wider pill.
  const round = [save, onShare, more].filter(Boolean).length;
  const rightRoom = round * (layout.minTapTarget + space.sm) + (onEdit ? EDIT_PILL + space.sm : 0);
  const backing = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.get(), [tuck - space.xxxl, tuck], [0, 1], 'clamp') }));
  // The small title once the big one (a display line, about 64) has gone under the bar.
  const small = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.get(), [tuck + space.xl, tuck + space.xxxl + space.sm], [0, 1], 'clamp') }));
  const back = noBack ? (
    <View />
  ) : (
    <GlassButton
      accessibilityLabel={backLabel ?? 'Back'}
      icon="chevron.left"
      label={backLabel}
      scheme={over}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
  return (
    <>
      <Animated.View style={[styles.backing, { height: barHeight, backgroundColor: ds.c.ground, borderBottomColor: ds.c.line }, backing]} />
      {children}
      <Animated.View style={[styles.title, { top: top + space.sm, height: layout.minTapTarget, left: gutter + layout.minTapTarget + space.sm + titleInset, right: gutter + rightRoom }, small]} aria-hidden>
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
