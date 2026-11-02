import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { DsText, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, layout, radius, space } from '@/constants/tokens';

/**
 * The top of "Had a drink? Rank it" (Loop-rank board): the label and the field
 * that opens the sheet. They paint with Tonight, so they stay this small; the
 * rows are in RankRow.tsx, which loads after.
 */

/** "Had a drink? Rank it": sentence case, 15 pt semibold (not a section's small capitals). */
export function RankLabel({ children }: { children: string }) {
  return (
    <DsText variant="label" role="heading" style={font.semiBold}>
      {children}
    </DsText>
  );
}

/** "What did you have?" with search leading and `camera` trailing: tap opens the Rank it sheet. */
export function RankField({ onPress, camera }: { onPress: () => void; camera: ReactNode }) {
  const ds = useDs();
  return (
    <View style={[styles.field, { backgroundColor: ds.c.raised, borderColor: ds.c.lineStrong }]}>
      <PressableScale role="button" accessibilityLabel="What did you have? Find a drink to rank" onPress={onPress} style={styles.fieldPress}>
        <IconSymbol name="magnifyingglass" size={18} color={ds.c.muted} />
        <DsText variant="body" tone="muted" numberOfLines={1} style={styles.flex}>
          What did you have?
        </DsText>
      </PressableScale>
      {camera}
    </View>
  );
}

/** The field's camera: snaps a menu. No `onPress` while its code loads. */
export function RankCameraButton({ onPress }: { onPress?: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="button" accessibilityLabel="Snap the menu" disabled={!onPress} onPress={onPress} style={styles.camera}>
      <IconSymbol name="camera" size={20} color={ds.c.muted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', minHeight: layout.minTapTarget + space.sm, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  fieldPress: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'stretch', paddingLeft: space.lg, paddingRight: space.sm },
  camera: { width: layout.minTapTarget, height: layout.minTapTarget, marginRight: space.xs, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
});
