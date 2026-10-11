import type { ColorValue } from 'react-native';
import Svg, { Path, Rect, Text } from 'react-native-svg';

import { fontFamilies } from '@/constants/tokens';
import { useServiceDay } from '@/hooks/useServiceDay';

/** The day's size in the glyph's 24-unit box: the canvas's 7.5, a touch bigger to read at tab size. */
const DAY_UNITS = 8;

/**
 * The Tonight tab on web: a calendar page with the service day's date, which
 * turns over at 6am (hooks/useServiceDay.ts). The same drawing as the native
 * tab's (components/nav/tabCalendar.ts). A blank page until hydrated.
 */
export function CalendarDayIcon({ size, color }: { size: number; color: ColorValue }) {
  const day = useServiceDay();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <Rect x={4} y={5} width={16} height={15} rx={2.5} stroke={color} strokeWidth={2} />
      <Path d="M4 10h16M8.5 3v4M15.5 3v4" stroke={color} strokeWidth={2} strokeLinecap="round" />
      {day ? (
        <Text x={12} y={18} textAnchor="middle" fontFamily={fontFamilies.bodySemiBold} fontSize={DAY_UNITS} fill={color}>
          {String(day)}
        </Text>
      ) : null}
    </Svg>
  );
}
