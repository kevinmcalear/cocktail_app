import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, PressableScale, Sheet, Title, useDs, useSheetClose, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, space, STATUS } from '@/constants/tokens';
import { readableAccent } from '@/lib/color';

export interface MoreRow {
  key: string;
  icon: IconName;
  label: string;
  onPick: () => void;
}

/** The sheet under a page's … (ItemMoreMenu): one row per thing the viewer can do. */
export function ItemMoreSheet({ visible, rows, onClose, onDismiss, onPick }: { visible: boolean; rows: MoreRow[]; onClose: () => void; onDismiss: () => void; onPick: (onPick: () => void) => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} onDismiss={onDismiss} accessibilityLabel="More" header={<Header />}>
      <ScrollView contentContainerStyle={styles.body}>
        {rows.map((r) => (
          <Row key={r.key} icon={r.icon} label={r.label} onPick={() => onPick(r.onPick)} />
        ))}
      </ScrollView>
    </Sheet>
  );
}

function Header() {
  const ds = useDs();
  const close = useSheetClose();
  return (
    <View style={styles.header}>
      <Title style={styles.flex}>More</Title>
      <PressableScale accessibilityLabel="Close" onPress={close} style={styles.close}>
        <IconSymbol name="xmark" size={18} color={ds.c.muted} />
      </PressableScale>
    </View>
  );
}

/** A row that closes the menu first, then does its thing. */
function Row({ icon, label, danger, onPick }: { icon: IconName; label: string; danger?: boolean; onPick: () => void }) {
  const ds = useDs();
  const close = useSheetClose();
  const tint = danger ? readableAccent(STATUS.danger, ds.c.ground) : undefined;
  return (
    <PressableScale
      role="button"
      accessibilityLabel={label}
      onPress={() => {
        onPick();
        close();
      }}
      style={[styles.row, { borderBottomColor: ds.c.line }]}
    >
      <IconSymbol name={icon} size={20} color={tint ?? ds.c.ink} />
      <Body color={tint} style={styles.flex}>
        {label}
      </Body>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.sm },
  flex: { flex: 1 },
  close: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: space.xl, paddingBottom: space.xxxl, gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
});
