import { StyleSheet, View } from 'react-native';

import { Button, DsText, PressableScale, useDs, useSheetClose } from '@/components/ds';
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

/**
 * Android's full-screen dialog bar (canvas Theme-and, Theme-type Android): X
 * closes, the title, and Save as a text button in the bar's colour.
 */
export function DialogBar({ title, onClose, onSave, canSave = true, saveLabel = 'Save' }: { title: string; onClose: () => void; onSave?: () => void; canSave?: boolean; saveLabel?: string }) {
  const ds = useDs();
  return (
    <View style={styles.bar}>
      <PressableScale role="button" accessibilityLabel="Close" onPress={onClose} style={styles.icon}>
        <IconSymbol name="xmark" size={24} color={ds.c.ink} />
      </PressableScale>
      <DsText variant="headline" role="heading" numberOfLines={1} style={styles.title}>{title}</DsText>
      {onSave ? (
        <PressableScale role="button" accessibilityLabel={saveLabel} aria-disabled={!canSave} disabled={!canSave} onPress={onSave} style={[styles.text, { opacity: canSave ? 1 : 0.4 }]}>
          <DsText variant="label" color={ds.accentText} style={styles.medium}>{saveLabel}</DsText>
        </PressableScale>
      ) : null}
    </View>
  );
}

/** The web's dialog head (canvas Theme-type, web): the title, then Cancel and Done. */
export function DialogHead({ title, onDone }: { title: string; onDone: () => void }) {
  const ds = useDs();
  const close = useSheetClose();
  return (
    <View style={[styles.dialogHead, { borderBottomColor: ds.c.line }]}>
      <DsText variant="headline" role="heading" style={[styles.title, styles.strong]}>{title}</DsText>
      <Button label="Cancel" variant="secondary" size="sm" onPress={close} />
      <Button label="Done" size="sm" onPress={onDone} />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { flex: 1 },
  strong: { ...font.semiBold },
  medium: { ...font.medium },
  round: { width: layout.minTapTarget, height: layout.minTapTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  // Material's small top app bar: 64 tall, a 48 touch target for the X, the title at 22.
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.xs, height: 64, paddingLeft: space.xs, paddingRight: space.md },
  icon: { width: 48, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  text: { minHeight: 48, paddingHorizontal: space.md, justifyContent: 'center', borderRadius: radius.pill },
  dialogHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingLeft: space.xl + space.xs, paddingRight: space.xl, paddingTop: space.lg + space.xs, paddingBottom: space.lg + 2, borderBottomWidth: StyleSheet.hairlineWidth },
});
