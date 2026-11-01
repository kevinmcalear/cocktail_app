import { StyleSheet, View } from 'react-native';

import { DsText, PressableScale, useDs, useSheetClose } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, layout, radius, space } from '@/constants/tokens';

/**
 * A theme sheet's title row (canvas Theme-flow-3, th-n-type): X cancels, the
 * title, and the round check in the bar's colour, the one prominent action.
 */
export function FlowHead({ title, onDone, canDone = true }: { title: string; onDone: () => void; canDone?: boolean }) {
  const ds = useDs();
  const close = useSheetClose();
  return (
    <View style={[styles.head, { borderBottomColor: ds.c.line }]}>
      <PressableScale role="button" accessibilityLabel="Cancel" onPress={close} style={[styles.round, { backgroundColor: ds.c.raised }]}>
        <IconSymbol name="xmark" size={18} color={ds.c.ink} />
      </PressableScale>
      <DsText variant="body" align="center" role="heading" style={[styles.title, styles.strong]}>{title}</DsText>
      <PressableScale
        role="button"
        accessibilityLabel="Done"
        aria-disabled={!canDone}
        disabled={!canDone}
        onPress={onDone}
        style={[styles.round, { backgroundColor: ds.accentFill.fill, opacity: canDone ? 1 : 0.4 }]}
      >
        <IconSymbol name="checkmark" size={20} color={ds.accentFill.text} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { flex: 1 },
  strong: { ...font.semiBold },
  round: { width: layout.minTapTarget, height: layout.minTapTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
