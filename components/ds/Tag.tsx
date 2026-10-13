import type { ComponentProps } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { STATUS } from '@/constants/palette';
import { radius, space } from '@/constants/tokens';
import { readableAccent, withAlpha } from '@/lib/color';

import { DsText } from './Text';
import { useDs } from './theme';

export type TagTone = 'default' | 'accent' | 'outline' | 'paper' | 'success' | 'warning';

/**
 * A small label. `paper` is pencil ink on the house paper (the wizard band's
 * "House prep"). Drawn pictures carry no tag: drawings are obviously drawings.
 * Status tones are never the only signal: the label says what it means.
 * `outline` is a hairline pill in muted ink ("Need Cynar", a lock and
 * "Names only"); `icon` sits before the label, or `dot`, a small dot in the
 * label's colour (a menu's "On now since ...").
 */
export function Tag({ label, tone = 'default', icon, dot, style }: { label: string; tone?: TagTone; icon?: ComponentProps<typeof IconSymbol>['name']; dot?: boolean; style?: StyleProp<ViewStyle> }) {
  const ds = useDs();
  const statusText = (hex: string) => readableAccent(hex, ds.c.ground);
  const look = {
    default: { bg: ds.c.raised, fg: ds.c.ink, border: 'transparent' },
    accent: { bg: withAlpha(ds.accentText, 0.14), fg: ds.accentText, border: withAlpha(ds.accentText, 0.4) },
    outline: { bg: 'transparent', fg: ds.c.muted, border: ds.c.lineStrong },
    paper: { bg: ds.c.paper, fg: ds.c.sketchInk, border: withAlpha(ds.c.sketchInk, 0.35) },
    success: { bg: withAlpha(STATUS.success, 0.14), fg: statusText(STATUS.success), border: 'transparent' },
    warning: { bg: withAlpha(STATUS.warning, 0.16), fg: statusText(STATUS.warning), border: 'transparent' },
  }[tone];
  return (
    <View style={[styles.tag, { backgroundColor: look.bg, borderColor: look.border }, style]}>
      {icon ? <IconSymbol name={icon} size={12} color={look.fg} /> : null}
      {dot ? <View style={[styles.dot, { backgroundColor: look.fg }]} /> : null}
      <DsText variant="caption" color={look.fg} numberOfLines={1}>
        {label}
      </DsText>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 2,
  },
  dot: { width: 7, height: 7, borderRadius: radius.pill },
});
