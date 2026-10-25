import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { toQR } from 'toqr';

import { useDs } from '@/components/ds';
import { printPaper } from '@/constants/tokens';

import { qrPath } from '../make/makeLogic';

/**
 * A QR code that opens `url`: dark modules on white with a one-module quiet
 * zone, so a phone reads it off the printed guest card (venue-menus-guestcard).
 * onPaper: dark on paper in either theme, for a code read off a screen (a light-on-dark code won't scan everywhere).
 */
export function DrinkCode({ url, label, size = 60, onPaper = false }: { url: string; label: string; size?: number; onPaper?: boolean }) {
  const ds = useDs();
  const { d, size: n } = qrPath(toQR(url), 1);
  return (
    <View role="img" aria-label={label} style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${n} ${n}`}>
        <Rect width={n} height={n} fill={onPaper ? printPaper.paper : ds.c.surface} />
        <Path d={d} fill={onPaper ? printPaper.ink : ds.c.ink} />
      </Svg>
    </View>
  );
}
