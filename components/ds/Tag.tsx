import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { STATUS } from '@/constants/palette';
import { radius, space } from '@/constants/tokens';
import { readableAccent, withAlpha } from '@/lib/color';

import { DsText } from './Text';
import { useDs } from './theme';

export type TagTone = 'default' | 'accent' | 'sketch' | 'success' | 'warning';

/**
 * A small label. `sketch` marks a generated image everywhere it appears, so
 * nobody mistakes it for a photo of the real drink. Status tones are never the
 * only signal: the label says what it means.
 */
export function Tag({ label, tone = 'default', style }: { label: string; tone?: TagTone; style?: StyleProp<ViewStyle> }) {
  const ds = useDs();
  const statusText = (hex: string) => readableAccent(hex, ds.c.ground);
  const look = {
    default: { bg: ds.c.raised, fg: ds.c.ink, border: 'transparent' },
    accent: { bg: withAlpha(ds.accentText, 0.14), fg: ds.accentText, border: withAlpha(ds.accentText, 0.4) },
    sketch: { bg: ds.c.paper, fg: ds.c.sketchInk, border: withAlpha(ds.c.sketchInk, 0.35) },
    success: { bg: withAlpha(STATUS.success, 0.14), fg: statusText(STATUS.success), border: 'transparent' },
    warning: { bg: withAlpha(STATUS.warning, 0.16), fg: statusText(STATUS.warning), border: 'transparent' },
  }[tone];
  return (
    <View style={[styles.tag, { backgroundColor: look.bg, borderColor: look.border }, style]}>
      <DsText variant="caption" color={look.fg} numberOfLines={1}>
        {label}
      </DsText>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 2,
  },
});
