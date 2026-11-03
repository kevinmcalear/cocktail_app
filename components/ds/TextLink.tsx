import { StyleSheet } from 'react-native';

import { PressableScale } from './PressableScale';
import { DsText } from './Text';
import { useDs } from './theme';

/** A text action, in the venue's accent unless `tone` says ink ("Add another page", "Finish"), at least 44 tall. */
export function TextLink({ label, onPress, accessibilityHint, tone = 'accent', disabled }: {
  label: string;
  onPress: () => void;
  accessibilityHint?: string;
  /** `ink` where the screen's one accent is already spoken for (a menu's Guest card beside Go live). */
  tone?: 'accent' | 'ink';
  /** Shown muted and not pressable (Email us instead while a note is sending). */
  disabled?: boolean;
}) {
  const ds = useDs();
  return (
    <PressableScale accessibilityLabel={label} accessibilityHint={accessibilityHint} onPress={onPress} disabled={disabled} aria-disabled={disabled || undefined} style={styles.link}>
      <DsText variant="body" color={disabled ? ds.c.muted : tone === 'ink' ? ds.c.ink : ds.accentText}>
        {label}
      </DsText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  link: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
