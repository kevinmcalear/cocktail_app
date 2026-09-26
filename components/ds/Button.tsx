import type { ComponentProps } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';

import { PressableScale } from './PressableScale';
import { DsText } from './Text';
import { useDs } from './theme';

export type IconName = ComponentProps<typeof IconSymbol>['name'];

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  /** primary: the one main action on a screen, in the venue's accent. */
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'lg';
  icon?: IconName;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, variant = 'primary', size = 'md', icon, disabled, accessibilityHint, style }: ButtonProps) {
  const ds = useDs();
  const fill = variant === 'primary' ? ds.accentFill.fill : 'transparent';
  const text = variant === 'primary' ? ds.accentFill.text : ds.c.ink;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      aria-disabled={disabled}
      style={[
        styles.base,
        {
          height: size === 'lg' ? 52 : layout.minTapTarget,
          backgroundColor: fill,
          borderColor: variant === 'secondary' ? ds.c.lineStrong : 'transparent',
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
