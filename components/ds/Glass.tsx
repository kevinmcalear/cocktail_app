import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';

import type { IconName } from './Button';
import { PressableScale } from './PressableScale';
import { DsText } from './Text';
import { useDs } from './theme';

const LIQUID_GLASS = isLiquidGlassAvailable();

/**
 * The control layer: tab bars, toolbars, floating buttons, sheets. Never put
 * content in glass. Real Liquid Glass on iOS 26+, a blur on web and older iOS,
 * and a solid raised surface on Android (expo-blur can't blur it cleanly there).
 */
export function GlassSurface({ children, style, interactive }: { children: ReactNode; style?: StyleProp<ViewStyle>; interactive?: boolean }) {
  const ds = useDs();
  if (LIQUID_GLASS) {
    return (
      <GlassView glassEffectStyle="regular" isInteractive={interactive} colorScheme={ds.scheme} style={[styles.clip, style]}>
        {children}
      </GlassView>
    );
  }
  if (Platform.OS === 'android') {
    return <View style={[styles.clip, { backgroundColor: ds.c.raised, borderColor: ds.c.glassBorder, borderWidth: 1, elevation: 6 }, style]}>{children}</View>;
  }
  return (
    <BlurView intensity={60} tint={ds.scheme} style={[styles.clip, { backgroundColor: ds.c.glass, borderColor: ds.c.glassBorder, borderWidth: 1 }, style]}>
      {children}
    </BlurView>
  );
}

interface GlassButtonProps {
  /** Required: glass buttons are often icon-only. */
  accessibilityLabel: string;
  icon?: IconName;
  label?: string;
  onPress?: () => void;
  /** Ink colour on a light photo (a sketch), where the default light ink would vanish. */
  color?: string;
}

/** A floating circle (icon only) or pill (with a label) over content. */
export function GlassButton({ accessibilityLabel, icon, label, onPress, color }: GlassButtonProps) {
  const ds = useDs();
  const ink = color ?? ds.c.ink;
  return (
    <PressableScale onPress={onPress} accessibilityLabel={accessibilityLabel} hitSlop={4}>
      <GlassSurface interactive style={label ? styles.pill : styles.circle}>
        <View style={styles.row}>
          {icon ? <IconSymbol name={icon} size={18} color={ink} /> : null}
          {label ? (
            <DsText variant="caption" color={ink} style={{ fontFamily: fontFamilies.bodySemiBold }}>
              {label}
            </DsText>
          ) : null}
        </View>
      </GlassSurface>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden', borderRadius: radius.pill, borderCurve: 'continuous' },
  circle: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  pill: { height: layout.minTapTarget, paddingHorizontal: space.lg, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
