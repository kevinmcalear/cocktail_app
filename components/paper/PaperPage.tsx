import { Image } from 'expo-image';
import type { ComponentRef, Ref } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { drawingUri, useDisplayFaces } from '@/components/ds';
import { font } from '@/constants/tokens';
import type { PaperEl, PaperPage as Page } from '@/lib/paper/page';
import type { SketchInputs } from '@/lib/sketch/types';

const WEIGHT = { '400': font.regular, '500': font.medium, '600': font.semiBold } as const;
// Room above the ascenders, so iOS doesn't cut the tops off a display line (displayClip.check.ts).
const LEADING = 1.25;

interface PaperPageProps {
  page: Page;
  /** Points per page unit: the page is drawn page.w × unit points wide. */
  unit: number;
  /** Drawing inputs by drink id; a drink not in here isn't drawn yet. */
  sketches: Record<string, SketchInputs | null | undefined>;
  /** The page's own view, to take its picture (lib/paper/picture). */
  ref?: Ref<ComponentRef<typeof View>>;
}

/**
 * Paints a page from the drawn renderer (lib/paper/page.ts) on screen, in
 * native views on phones and the DOM on the web, so the picture taken of it
 * is the same on all four platforms. Names in the page's display face, the
 * rest in the system font, drawings from lib/sketch as the app draws them.
 */
export function PaperPage({ page, unit, sketches, ref }: PaperPageProps) {
  const face = useDisplayFaces([page.displayFace]);
  return (
    <View
      ref={ref}
      collapsable={false}
      role="img"
      aria-label={page.alt}
      style={[styles.page, { width: page.w * unit, height: page.h * unit, backgroundColor: page.ground }]}
    >
      {page.els.map((el, i) => (
        <PaperThing key={i} el={el} unit={unit} sketches={sketches} family={face(page.displayFace)} />
      ))}
    </View>
  );
}

function PaperThing({ el, unit, sketches, family }: { el: PaperEl; unit: number; sketches: PaperPageProps['sketches']; family: string }) {
  if (el.k === 'box') {
    return <View aria-hidden style={[styles.at, { left: el.x * unit, top: el.y * unit, width: el.w * unit, height: el.h * unit, backgroundColor: el.fill, borderRadius: (el.r ?? 0) * unit }]} />;
  }
  if (el.k === 'drawing') {
    const inputs = sketches[el.itemId];
    if (!inputs) return null;
    const box = { left: el.x * unit, top: el.y * unit, width: el.s * unit, height: el.s * unit };
    return <Image source={{ uri: drawingUri(inputs, el.itemId, el.night) }} style={[styles.at, box]} contentFit="contain" cachePolicy="memory" accessible={false} />;
  }
  const size = el.size * unit;
  const type = el.face === 'display' ? { fontFamily: family } : WEIGHT[el.weight ?? '400'];
  return (
    <Text
      aria-hidden
      numberOfLines={1}
      style={[
        styles.at,
        type,
        { left: el.x * unit, top: el.y * unit, width: el.w * unit, fontSize: size, lineHeight: size * LEADING, letterSpacing: (el.tracking ?? 0) * size, color: el.color, textAlign: el.align },
      ]}
    >
      {el.t}
    </Text>
  );
}

const styles = StyleSheet.create({
  page: { overflow: 'hidden' },
  at: { position: 'absolute' },
});
