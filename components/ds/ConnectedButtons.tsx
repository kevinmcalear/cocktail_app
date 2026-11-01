import { Pressable, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { material } from '@/constants/material';
import { font, radius, space } from '@/constants/tokens';

import { DsText } from './Text';

interface ConnectedButtonsProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  colors: { picked: string; onPicked: string; rest: string; onRest: string };
}

/**
 * Material 3 Expressive's connected button group (And-kit-hybrid): 40 tall, 2
 * apart, its ends round and the seams nearly square, the picked one a full
 * pill with a check. Drawn here because @expo/ui has no such group yet; swap
 * when it ships. Android only, so it isn't in the ds barrel.
 */
export function ConnectedButtons<T extends string>({ options, value, onChange, accessibilityLabel, colors }: ConnectedButtonsProps<T>) {
  return (
    <View role="radiogroup" accessibilityLabel={accessibilityLabel} style={styles.group}>
      {options.map((o, i) => {
        const on = o.value === value;
        const ink = on ? colors.onPicked : colors.onRest;
        const first = i === 0;
        const last = i === options.length - 1;
        return (
          <Pressable
            key={o.value}
            role="radio"
            aria-checked={on}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            android_ripple={{ color: ink, foreground: true }}
            style={[
              styles.button,
              on ? styles.on : styles.off,
              {
                backgroundColor: on ? colors.picked : colors.rest,
                borderTopLeftRadius: on || first ? END : SEAM,
                borderBottomLeftRadius: on || first ? END : SEAM,
                borderTopRightRadius: on || last ? END : SEAM,
                borderBottomRightRadius: on || last ? END : SEAM,
              },
            ]}
          >
            {on ? <IconSymbol name="checkmark" size={18} color={ink} /> : null}
            <DsText numberOfLines={1} color={ink} style={styles.label}>
              {o.label}
            </DsText>
          </Pressable>
        );
      })}
    </View>
  );
}

const END = material.control / 2;
const SEAM = radius.mark * 2;

const styles = StyleSheet.create({
  group: { flexDirection: 'row', gap: 2 },
  button: { height: material.control, flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, overflow: 'hidden' },
  on: { paddingLeft: space.md, paddingRight: space.lg },
  off: { paddingHorizontal: space.lg },
  label: { ...material.label, ...font.medium },
});
