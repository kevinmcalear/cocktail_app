import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { toQR } from 'toqr';

import { useDs } from '@/components/ds';
import { printPaper } from '@/constants/tokens';

import { qrPath } from '../make/makeLogic';

/**
 * A QR code that opens `url`: dark modules on white with a one-module quiet
 * zone, so a phone reads it off the printed guest card (venue-menus-guestcard).
 * onPaper: dark on paper in either theme, for a code read off a screen (a light-on-dark code won't scan everywhere).
 * mark: sits in the middle (a bar's mark on its staff link), on the highest error correction so the code still scans.
 */
export function DrinkCode({ url, label, size = 60, onPaper = false, mark }: { url: string; label: string; size?: number; onPaper?: boolean; mark?: ReactNode }) {
  const ds = useDs();
  // toqr's ECLevel is a const enum it doesn't export: 2 is H.
  const { d, size: n } = qrPath(toQR(url, mark ? 2 : undefined), 1);
  return (
    <View role="img" aria-label={label} style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${n} ${n}`}>
        <Rect width={n} height={n} fill={onPaper ? printPaper.paper : ds.c.surface} />
        <Path d={d} fill={onPaper ? printPaper.ink : ds.c.ink} />
      </Svg>
      {mark ? <View style={styles.mark}>{mark}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
