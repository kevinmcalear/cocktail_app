import { Platform, Pressable, Switch as NativeSwitch, StyleSheet, View } from 'react-native';

import { backbar, radius } from '@/constants/tokens';

import { useDs } from './theme';

const W = 52;
const H = 32;
const KNOB = 26;

/**
 * An on/off switch. On the web it's drawn as the canvas draws it (ppl-what-people-see,
 * tools-settings): a 52 by 32 track, the accent when on with a dark knob, a muted
 * knob on a faint track when off. react-native-web's own switch is a small
 * Material one. Native keeps the platform switch.
 */
export function Switch({ value, onValueChange, label, disabled }: { value: boolean; onValueChange: (on: boolean) => void; label: string; disabled?: boolean }) {
  const ds = useDs();
  if (Platform.OS !== 'web') {
    return (
      <NativeSwitch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        // Android's Switch ignores aria-label; this one reaches TalkBack.
        accessibilityLabel={label}
        trackColor={{ false: ds.c.lineStrong, true: ds.accentFill.fill }}
        thumbColor={backbar.light.surface}
      />
    );
  }
  return (
    <Pressable
      role="switch"
      aria-checked={value}
      aria-label={label}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={[styles.track, { backgroundColor: value ? ds.accentFill.fill : ds.c.lineStrong, opacity: disabled ? 0.45 : 1 }]}
    >
      <View style={[styles.knob, value ? styles.on : styles.off, { backgroundColor: value ? ds.c.ground : ds.c.muted }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: W, height: H, borderRadius: radius.pill, flexShrink: 0, justifyContent: 'center' },
  knob: { position: 'absolute', width: KNOB, height: KNOB, borderRadius: radius.pill },
  on: { right: (H - KNOB) / 2 },
  off: { left: (H - KNOB) / 2 },
});
