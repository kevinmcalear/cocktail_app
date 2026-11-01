import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { pour as POUR } from '@/constants/tokens';

import { EASE_OUT, webMotion } from './webMotion';

/** The web's pour (PourLevel.tsx): a CSS keyframe from an empty glass to full. */
export function PourLevel({ moving, children }: { moving: boolean; children: ReactNode }) {
  return <View style={[styles.level, moving ? styles.pouring : null]}>{children}</View>;
}

const styles = StyleSheet.create({
  level: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '100%', overflow: 'hidden' },
  pouring: webMotion({
    animationKeyframes: { '0%': { height: '0%' }, [`${Math.round((POUR.delay / (POUR.delay + POUR.ms)) * 100)}%`]: { height: '0%' }, '100%': { height: '100%' } },
    animationDuration: `${POUR.delay + POUR.ms}ms`,
    animationTimingFunction: EASE_OUT,
    animationFillMode: 'both',
  }),
});
