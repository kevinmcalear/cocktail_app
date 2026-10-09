import { Platform, Share, StyleSheet, View } from 'react-native';

import { Body, Caption, Field, Headline, Spec, Surface, Title, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { labelDate } from '@/lib/makeSteps';

export interface BatchLabel {
  name: string;
  made: Date;
  useBy: Date | null;
  by: string;
  amount: string | null;
  storage: string | null;
  allergens: string;
}

/** The label's lines, as printed or written on tape. */
export function labelText(l: BatchLabel): string {
  return [
    l.name,
    `MADE ${labelDate(l.made).toUpperCase()}${l.by ? ` · ${l.by}` : ''}`,
    l.useBy ? `USE BY ${labelDate(l.useBy).toUpperCase()}` : null,
    [l.amount, l.storage, l.allergens].filter(Boolean).join(' · '),
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Hand the label on: on the web the browser's print, on a phone the share
 * sheet (a label printer's app or a note).
 * ponytail: no direct label-printer support; add a print route with a page sized to the roll when a bar asks.
 */
export async function shareLabel(l: BatchLabel) {
  const text = labelText(l);
  if (Platform.OS === 'web') {
    const w = window.open('', '_blank', 'width=420,height=320');
    if (!w) return;
    w.document.title = `${l.name} label`;
    const pre = w.document.createElement('pre');
    pre.textContent = text;
    pre.setAttribute('style', 'font: 600 16px/1.4 ui-monospace, monospace; margin: 16px');
    w.document.body.appendChild(pre);
    w.print();
    return;
  }
  await Share.share({ message: text });
}

interface MakeDoneProps {
  label: BatchLabel;
  /** "It made": typed by whoever made it; the yield learns from it. Null when the prep has no volume or weight yield. */
  made: string | null;
  onMade: (v: string) => void;
  madeUnit: string | null;
}

/** Make, last screen: when it was made, when to use it by, and the label to stick on it. */
export function MakeDone({ label, made, onMade, madeUnit }: MakeDoneProps) {
  const ds = useDs();
  return (
    <View style={styles.stack}>
      <View style={[styles.tick, { backgroundColor: ds.c.ink }]}>
        <IconSymbol name="checkmark" size={24} color={ds.c.ground} />
      </View>
      <Title>Made. Label it.</Title>
      <Surface style={styles.facts}>
        <Row label="Made" value={`Today, ${labelDate(label.made)}${label.by ? ` · ${label.by}` : ''}`} />
        {label.useBy ? <Row label="Use by" value={labelDate(label.useBy)} strong /> : null}
        {label.storage ? <Row label="Goes in" value={label.storage} /> : null}
      </Surface>
      {made !== null ? (
        <>
          <Field label={`It made (${madeUnit})`} value={made} onChangeText={onMade} keyboardType="decimal-pad" />
          <Caption tone="muted">{"Came out more or less? Change it and the recipe's yield learns from it."}</Caption>
        </>
      ) : null}
      <Caption tone="muted" style={styles.eyebrow}>LABEL</Caption>
      <View style={[styles.label, { borderColor: ds.c.lineStrong, backgroundColor: ds.c.surface }]} accessible accessibilityLabel={labelText(label).replace(/\n/g, ', ')}>
        <Headline>{label.name}</Headline>
        <Spec>{`MADE ${labelDate(label.made).toUpperCase()}${label.by ? ` · ${label.by}` : ''}`}</Spec>
        {label.useBy ? <Spec>{`USE BY ${labelDate(label.useBy).toUpperCase()}`}</Spec> : null}
        <Caption tone="muted">{[label.amount, label.storage, label.allergens].filter(Boolean).join(' · ')}</Caption>
      </View>
    </View>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const ds = useDs();
  return (
    <View style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <Body>{label}</Body>
      {strong ? <Body>{value}</Body> : <Body tone="muted">{value}</Body>}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  tick: { width: 52, height: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  facts: { paddingVertical: 0 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  eyebrow: { letterSpacing: 0.6 },
  label: { alignSelf: 'flex-start', minWidth: 240, borderWidth: 1, borderRadius: radius.mark, padding: space.md, gap: 2 },
});
