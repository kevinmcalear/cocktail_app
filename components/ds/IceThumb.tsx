import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius } from '@/constants/tokens';
import { draftSketchInputs } from '@/lib/sketch/draft';
import type { SketchIce } from '@/lib/sketch/types';

import { SketchDrawing } from './SketchDrawing';
import { useDs } from './theme';

const EMPTY = draftSketchInputs({ name: '', lines: [] });

/** A kind of ice drawn in an empty glass: a spear in a highball, the rest in a rocks glass (Kit, the ice layers). */
export function IceThumb({ kind, size = 48 }: { kind: Exclude<SketchIce, 'none'>; size?: number }) {
  const ds = useDs();
  const inputs = useMemo(() => ({ ...EMPTY, glass: kind === 'spear' ? ('highball' as const) : ('rocks' as const), variant: null, ice: kind }), [kind]);
  return (
    <View style={[styles.paper, { width: size, height: size, backgroundColor: ds.c.paper }]} aria-hidden>
      <SketchDrawing inputs={inputs} seed={`bar-ice-${kind}`} detail="thumb" />
    </View>
  );
}

const styles = StyleSheet.create({
  paper: { borderRadius: radius.control, overflow: 'hidden', borderCurve: 'continuous' },
});
