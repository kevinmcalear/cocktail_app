import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { toQR } from 'toqr';

import { useDs } from '@/components/ds';

import { qrPath } from '../make/makeLogic';

/**
 * A QR code that opens `url`: dark modules on white with a one-module quiet
 * zone, so a phone reads it off the printed guest card (venue-menus-guestcard).
 */
export function DrinkCode({ url, label, size = 60 }: { url: string; label: string; size?: number }) {
  const ds = useDs();
  const { d, size: n } = qrPath(toQR(url), 1);
  return (
    <View role="img" aria-label={label} style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${n} ${n}`}>
        <Rect width={n} height={n} fill={ds.c.surface} />
        <Path d={d} fill={ds.c.ink} />
      </Svg>
    </View>
  );
}
