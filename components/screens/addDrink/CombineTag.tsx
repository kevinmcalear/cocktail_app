import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Body, Caption, useDs } from '@/components/ds';
import { backbar, font, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';

/** The tag's point, down at the card. */
const TAIL = 7;

/**
 * Over a line it can combine with, the held card's tag: just above the card,
 * where the thumb holding it doesn't cover it, pointing down at it (drag
 * options 1B, Kevin 27 Oct; make-anything-steps-1, step 3). Fades up in; no
 * layout animation (#298). In a drink made in parts, a line held over
 * another part says "Move to The cream" (`title`, no `pair`).
 */
export function CombineTag({ pair, title = 'Let go to make it in-house' }: { pair?: string; title?: string }) {
  const ds = useDs();
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.set(withTiming(1, { duration: 140 }));
  }, [shown]);
  const rise = useAnimatedStyle(() => ({ opacity: shown.get(), transform: [{ translateY: (1 - shown.get()) * 6 }] }));
  return (
    <Animated.View role="alert" style={[styles.wrap, rise]}>
      <View style={[styles.tag, { backgroundColor: ds.accentFill.fill }]}>
        <Body tone="onAccent" numberOfLines={1} style={styles.strong}>
          {title}
        </Body>
        {pair ? (
          <Caption tone="onAccent" numberOfLines={1}>
            {pair}
          </Caption>
        ) : null}
      </View>
      <View style={[styles.tail, { borderTopColor: ds.accentFill.fill }]} />
    </Animated.View>
  );
}

/** What's over a held line: letting go combines it (`combineWith`, that line's name), or moves it to another part. */
export function HeldTag({ name, lifted, combineWith, moveTo }: { name: string; lifted?: boolean; combineWith?: string | null; moveTo?: string | null }) {
  if (!lifted) return null;
  return combineWith ? <CombineTag pair={`${name} + ${combineWith}`} /> : moveTo ? <CombineTag title={`Move to ${moveTo}`} /> : null;
}

/** A spec line while one is held: its card, and the line it would combine with, lit up. Open or closed, a line looks the same. */
export function useHeldStyle(lifted?: boolean, combineWith?: string | null, dropTarget?: string | null) {
  const ds = useDs();
  return [
    lifted ? [styles.lifted, { backgroundColor: ds.c.raised, borderColor: combineWith ? ds.accentText : ds.c.lineStrong }] : null,
    dropTarget ? [styles.target, { borderColor: ds.accentText, backgroundColor: withAlpha(ds.accentText, 0.1) }] : null,
  ];
}

const styles = StyleSheet.create({
  // Being dragged: a card of its own, a little in from the edges, with a line round it (the accent when letting go combines).
  lifted: { borderWidth: 1.5, borderBottomWidth: 1.5, borderRadius: radius.control, marginHorizontal: space.sm, paddingVertical: space.sm, paddingHorizontal: space.sm, alignSelf: 'stretch', shadowColor: backbar.dark.ground, shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.45, shadowRadius: 22, elevation: 8 },
  // Lit up to drop on, as drawn: a dashed accent edge a little wider than the row.
  target: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: radius.control, marginHorizontal: -space.sm, paddingHorizontal: space.sm },
  wrap: { position: 'absolute', left: 0, right: 0, bottom: '100%', marginBottom: space.xs, alignItems: 'center', pointerEvents: 'none' },
  tag: { maxWidth: '100%', borderRadius: radius.control, paddingHorizontal: space.md, paddingVertical: space.sm, shadowColor: backbar.dark.ground, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 18, elevation: 10 },
  strong: { ...font.semiBold },
  tail: { width: 0, height: 0, borderLeftWidth: TAIL, borderRightWidth: TAIL, borderTopWidth: TAIL, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
});
