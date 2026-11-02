import { StyleSheet, View } from 'react-native';

import { Caption, DsText, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';

/** "Saved on this phone · offline": what an offline page shows comes from the phone (Sta-discover). */
export function SavedChip({ label }: { label: string }) {
  const ds = useDs();
  return (
    <View style={[styles.saved, { backgroundColor: ds.c.raised }]}>
      <IconSymbol name="phone" size={15} color={ds.c.ink} />
      <DsText variant="label">{label}</DsText>
    </View>
  );
}

/** At an offline page's foot: what comes back with a connection. */
export function OfflineNote({ text }: { text: string }) {
  const ds = useDs();
  return (
    <View style={styles.note}>
      <IconSymbol name="exclamationmark.triangle" size={16} color={ds.c.muted} />
      <Caption tone="muted" style={styles.flex}>
        {text}
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  saved: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space.xs + 2, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.sm },
});
