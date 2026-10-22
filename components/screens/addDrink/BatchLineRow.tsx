import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { batchCaption } from '@/lib/batchLines';
import { withAlpha } from '@/lib/color';
import { amountLabel, type WizardLine } from '@/lib/drinkWizard';

import { LineGrip } from './DragRow';

interface BatchLineRowProps {
  /** A line with a batch (lib/batchLines). */
  line: WizardLine;
  /** Opens the batch sheet: the bottle, the name, split back into lines. */
  onOpen: () => void;
  onRemove: () => void;
  grip?: (node: ReactNode) => ReactNode;
  onMove?: (by: -1 | 1) => void;
  lifted?: boolean;
  /** Another line is held over it: let go to put it in the bottle. */
  dropTarget?: boolean;
}

/**
 * The drink's one line for a batch (board fix 9, step 3): "Ash Garden batch",
 * "Batch · mezcal, agave syrup" under it, and what one drink takes, 60 ml.
 * The amount follows what's in it, so it's read here and changed in the sheet.
 */
export function BatchLineRow({ line, onOpen, onRemove, grip, onMove, lifted, dropTarget }: BatchLineRowProps) {
  const ds = useDs();
  if (!line.batch) return null;
  const amount = amountLabel(line);
  return (
    <View
      role="listitem"
      style={[styles.row, { borderBottomColor: ds.c.line, backgroundColor: lifted ? ds.c.raised : undefined }, dropTarget ? [styles.target, { borderColor: ds.accentText, backgroundColor: withAlpha(ds.accentText, 0.1) }] : null]}
    >
      {grip?.(
        <LineGrip name={line.name} onMove={onMove} />
      )}
      <View aria-hidden style={[styles.thumb, { backgroundColor: ds.c.paper }]}>
        <IconSymbol name="flask" size={22} color={ds.c.sketchInk} />
      </View>
      <PressableScale onPress={onOpen} haptic={false} role="button" accessibilityLabel={`${line.name}, ${amount}. ${batchCaption(line.batch)}`} accessibilityHint="Opens the batch: its bottle, its name, split it back" style={styles.main}>
        <Body numberOfLines={2}>{line.name}</Body>
        <Caption tone={dropTarget ? 'accent' : 'muted'} numberOfLines={2}>
          {dropTarget ? 'Drop to batch' : batchCaption(line.batch)}
        </Caption>
      </PressableScale>
      <DsText variant="spec" color={ds.c.muted}>
        {amount}
      </DsText>
      <PressableScale onPress={onRemove} role="button" accessibilityLabel={`Remove ${line.name}`} style={styles.remove}>
        <IconSymbol name="xmark" size={16} color={ds.c.muted} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  target: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: radius.control, marginHorizontal: -space.sm, paddingHorizontal: space.sm },
  thumb: { width: 40, height: 40, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  main: { flex: 1, minHeight: layout.minTapTarget, justifyContent: 'center' },
  remove: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
});
