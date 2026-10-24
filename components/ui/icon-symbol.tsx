import { type ColorValue, Platform, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path, Text } from 'react-native-svg';

import { fontFamilies } from '@/constants/tokens';
import { useServiceDay } from '@/hooks/useServiceDay';

import { GLYPHS, ICON_FILL, ICON_STROKE, type GlyphName } from './glyphs';

/**
 * An icon from the app's own set (components/ui/glyphs.ts), the same drawing
 * on iOS, Android and web. `on` fills its main shape with the colour at 22%:
 * the tab or place you're on. Names ending `.fill` are always on.
 * Decorative: say what it does on the control that holds it.
 */
export function IconSymbol({ name, size = 24, color, on, style }: { name: GlyphName; size?: number; color: ColorValue; on?: boolean; style?: StyleProp<ViewStyle> }) {
  // Android's back is an arrow, not the iOS chevron (every chevron.left in the app is a back button).
  const glyph = GLYPHS[name === 'chevron.left' && Platform.OS === 'android' ? 'arrow.left' : name];
  const fill = (on || glyph.on) && glyph.f;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style} aria-hidden>
      {fill ? <Path d={fill} fill={color} fillOpacity={glyph.solid ? 1 : ICON_FILL} /> : null}
      {glyph.d ? <Path d={glyph.d} stroke={color} strokeWidth={ICON_STROKE} strokeLinecap="round" strokeLinejoin="round" /> : null}
      {glyph.day ? <ServiceDay color={color} /> : null}
    </Svg>
  );
}

/** The day's size in the glyph's 24-unit box: the board's 7.5, a touch bigger to read at tab size. */
const DAY_UNITS = 8;

/** Tonight's date on its page, turning over at 6am (hooks/useServiceDay.ts). Blank until hydrated. */
function ServiceDay({ color }: { color: ColorValue }) {
  const day = useServiceDay();
  return day ? (
    <Text x={12} y={18} textAnchor="middle" fontFamily={fontFamilies.bodySemiBold} fontSize={DAY_UNITS} fill={color}>
      {String(day)}
    </Text>
  ) : null;
}
