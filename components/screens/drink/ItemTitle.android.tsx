import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';

import { Caption, Display } from '@/components/ds';
import { displayName, space } from '@/constants/tokens';

import { ItalicLine } from './ItalicLine';
import { useTitleGlide } from './MaterialBar.android';

export { ItalicLine, useItalic } from './ItalicLine';

/**
 * Android's name block, at the board's size. On a drawing's page the name
 * rides up into the bar (MaterialBar's GlideTitle, And-scroll-glide-*): this
 * one holds its place and hands over its measure, and the eyebrow and credit
 * fade out as the page moves.
 */
export function ItemTitle({ eyebrow, name, credit, children }: { eyebrow: string | null; name: string; credit?: ReactNode; children?: ReactNode }) {
  const glide = useTitleGlide();
  const scrollY = glide?.scrollY;
  const side = useAnimatedStyle(() => ({ opacity: scrollY ? interpolate(scrollY.get(), [30, 120], [1, 0], 'clamp') : 1 }));
  return (
    <View style={styles.title}>
      {eyebrow ? (
        <Animated.View style={side}>
          <Caption tone="muted" style={styles.eyebrow}>
            {eyebrow}
          </Caption>
        </Animated.View>
      ) : null}
      <View onLayout={(e) => glide?.setTop(e.nativeEvent.layout.y)}>
        <Display style={[displayName.page, glide?.ready ? styles.handedOver : null]} onTextLayout={(e) => glide?.setLines(e.nativeEvent.lines.length, Math.max(...e.nativeEvent.lines.map((l) => l.width)))}>
          {name}
        </Display>
      </View>
      <Animated.View style={[styles.title, side]}>
        {typeof credit === 'string' ? <ItalicLine text={credit} /> : credit}
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { gap: space.xs },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 1.2 },
  handedOver: { opacity: 0 },
});
