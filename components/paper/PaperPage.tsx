import { Image } from 'expo-image';
import { useEffect, useState, type ComponentRef, type Ref } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { toQR } from 'toqr';

import { drawingUri, loadFace, useDisplayFaces } from '@/components/ds';
import { qrPath } from '@/components/screens/make/makeLogic';
import { font, monoFont, type DisplayFace } from '@/constants/tokens';
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
  /** Whether its face and drawings are in, so a picture taken now is the page as laid out. */
  onPainted?: (painted: boolean) => void;
}

/**
 * Paints a page from the drawn renderer (lib/paper/page.ts) on screen, in
 * native views on phones and the DOM on the web, so the picture taken of it
 * is the same on all four platforms. Names in the page's display face, the
 * rest in the system font, drawings from lib/sketch as the app draws them.
 */
export function PaperPage({ page, unit, sketches, ref, onPainted }: PaperPageProps) {
  const face = useDisplayFaces([page.displayFace]);
  // loadFace also settles when a face can't load: its text stays in Redaction and the page can still be sent.
  const [settled, setSettled] = useState<DisplayFace | null>(null);
  useEffect(() => {
    let current = true;
    void loadFace(page.displayFace).then(() => {
      if (current) setSettled(page.displayFace);
    });
    return () => {
      current = false;
    };
  }, [page.displayFace]);

  const uris = page.els.map((el) => {
    const inputs = el.k === 'drawing' ? sketches[el.itemId] : null;
    return el.k === 'drawing' && inputs ? drawingUri(inputs, el.itemId, el.night) : null;
  });
  // A drawing that can't paint counts too, or the page could never be sent.
  const [arrived, setArrived] = useState<readonly string[]>([]);
  const arrive = (uri: string) => setArrived((a) => (a.includes(uri) ? a : [...a, uri]));
  const painted = settled === page.displayFace && uris.every((u) => !u || arrived.includes(u));
  useEffect(() => onPainted?.(painted), [painted, onPainted]);

  return (
    <View
      ref={ref}
      collapsable={false}
      role="img"
      aria-label={page.alt}
      style={[styles.page, { width: page.w * unit, height: page.h * unit, backgroundColor: page.ground }]}
    >
      {page.els.map((el, i) => (
        <PaperThing key={i} el={el} unit={unit} uri={uris[i]} onArrive={arrive} family={face(page.displayFace)} />
      ))}
    </View>
  );
}

function PaperThing({ el, unit, uri, onArrive, family }: { el: PaperEl; unit: number; uri: string | null; onArrive: (uri: string) => void; family: string }) {
  if (el.k === 'box') {
    const edge = el.stroke ? { borderWidth: Math.max(StyleSheet.hairlineWidth, unit), borderColor: el.stroke } : null;
    return <View aria-hidden style={[styles.at, edge, { left: el.x * unit, top: el.y * unit, width: el.w * unit, height: el.h * unit, backgroundColor: el.fill, borderRadius: (el.r ?? 0) * unit }]} />;
  }
  if (el.k === 'code') {
    const { d, size } = qrPath(toQR(el.url));
    return (
      <Svg aria-hidden width={el.s * unit} height={el.s * unit} viewBox={`0 0 ${size} ${size}`} style={[styles.at, { left: el.x * unit, top: el.y * unit }]}>
        <Path d={d} fill={el.color} />
      </Svg>
    );
  }
  if (el.k === 'drawing') {
    if (!uri) return null;
    const box = { left: el.x * unit, top: el.y * unit, width: el.s * unit, height: el.s * unit };
    // Eager: on the web a lazy image out of view waits, and the picture needs every drawing.
    return <Image source={{ uri }} style={[styles.at, box]} contentFit="contain" cachePolicy="memory" loading="eager" accessible={false} onLoad={() => onArrive(uri)} onError={() => onArrive(uri)} />;
  }
  const size = el.size * unit;
  const weight = WEIGHT[el.weight ?? '400'];
  const type = el.face === 'display' ? { fontFamily: family } : el.face === 'mono' ? { fontFamily: monoFont, fontWeight: weight.fontWeight } : weight;
  return (
    <Text
      aria-hidden
      numberOfLines={1}
      // fitSize guesses a face's letter width; where a face runs wider (the display face on iOS), the line shrinks to fit instead of cutting the name.
      adjustsFontSizeToFit
      minimumFontScale={0.5}
      allowFontScaling={false}
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
