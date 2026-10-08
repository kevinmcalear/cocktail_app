import type { ComponentProps } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { STATUS } from '@/constants/palette';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { readableAccent, withAlpha } from '@/lib/color';

import { PressableScale } from './PressableScale';
import { DsText } from './Text';
import { useDs } from './theme';

export type IconName = ComponentProps<typeof IconSymbol>['name'];

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  /** primary: the one main action on a screen, in the venue's accent. danger: removing or deleting, in status red. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'lg';
  icon?: IconName;
  disabled?: boolean;
  /** When the label alone is ambiguous ("Cancel" in a list of invites). Defaults to the label. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, variant = 'primary', size = 'md', icon, disabled, accessibilityLabel, accessibilityHint, style }: ButtonProps) {
  const ds = useDs();
  const fill = variant === 'primary' ? ds.accentFill.fill : 'transparent';
  const danger = readableAccent(STATUS.danger, ds.c.ground);
  const text = variant === 'primary' ? ds.accentFill.text : variant === 'danger' ? danger : ds.c.ink;
  const border = variant === 'secondary' ? ds.c.lineStrong : variant === 'danger' ? withAlpha(danger, 0.45) : 'transparent';
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      aria-disabled={disabled}
      style={[
        styles.base,
        {
          height: size === 'lg' ? 52 : layout.minTapTarget,
          backgroundColor: fill,
          borderColor: border,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {icon ? <IconSymbol name={icon} size={18} color={text} /> : null}
        <DsText variant="body" color={text} style={styles.label} numberOfLines={1}>
          {label}
        </DsText>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: space.xl,
    justifyContent: 'center',
    alignItems: 'center',
    borderCurve: 'continuous',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  label: { fontFamily: fontFamilies.bodySemiBold },
});
