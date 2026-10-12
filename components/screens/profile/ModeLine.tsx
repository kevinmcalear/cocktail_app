import { StyleSheet, View } from 'react-native';

import { Caption, TextLink } from '@/components/ds';
import { space } from '@/constants/tokens';
import { SHARE_MODES, type ShareMode } from '@/lib/profiles';

/** "Picked · 4 of 7 shown" with Change (to What people see), under a section on You. */
export function ModeLine({ mode, shown, total, onChange }: { mode: ShareMode; shown: number; total: number; onChange: () => void }) {
  const label = SHARE_MODES.find((m) => m.value === mode)?.label ?? 'All';
  return (
    <View style={styles.row}>
      <Caption tone="muted" style={styles.flex}>{`${label} · ${shown} of ${total} shown`}</Caption>
      <TextLink label="Change" accessibilityHint="Opens What people see" onPress={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
});
