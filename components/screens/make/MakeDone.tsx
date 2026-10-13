import { StyleSheet, TextInput, View } from 'react-native';

import { Body, Caption, GlassButton, Spec, Surface, Title, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { labelDate } from '@/lib/makeSteps';

import { LabelCard, type BatchLabel } from './MakeLabel';

export { copyForTape, shareLabel, type BatchLabel } from './MakeLabel';

interface MakeDoneProps {
  label: BatchLabel;
  /** Where it goes: its back bar spot ("Fridge 2 · top shelf"), else the prep's storage word. */
  goesIn: string | null;
  /** "It made": typed by whoever made it; the yield learns from it. Null when the prep has no volume or weight yield. */
  made: string | null;
  onMade: (v: string) => void;
  madeUnit: string | null;
  onClose: () => void;
}

/** Make, last screen: when it was made, when to use it by, where it goes, and the label to stick on it. */
export function MakeDone({ label, goesIn, made, onMade, madeUnit, onClose }: MakeDoneProps) {
  const ds = useDs();
  return (
    <View style={styles.stack}>
      <View style={styles.top}>
        <View style={[styles.tick, { backgroundColor: ds.c.ink }]}>
          <IconSymbol name="checkmark" size={24} color={ds.c.ground} />
        </View>
        <GlassButton accessibilityLabel="Close" icon="xmark" onPress={onClose} />
      </View>
      <Title>Made. Label it.</Title>
      <Surface style={styles.facts}>
        {/* It made first, its amount a pill you can change (prep-make-done). */}
        {made !== null ? (
          <View style={[styles.row, styles.center, { borderBottomColor: ds.c.line }]}>
            <Body>It made</Body>
            <View style={[styles.pill, { backgroundColor: ds.c.raised }]}>
              <TextInput
                value={made}
                onChangeText={onMade}
                keyboardType="decimal-pad"
                aria-label={`It made, in ${madeUnit}`}
                style={[styles.input, type.spec, { fontFamily: fontFamilies.monoMedium, color: ds.c.ink }]}
              />
              <Spec>{madeUnit}</Spec>
            </View>
          </View>
        ) : null}
        <Row label="Made" value={`Today, ${labelDate(label.made)}${label.by ? ` · ${label.by}` : ''}`} last={!label.useBy && !goesIn} />
        {label.useBy ? <Row label="Use by" value={labelDate(label.useBy)} strong last={!goesIn} /> : null}
        {goesIn ? <Row label="Goes in" value={goesIn} last /> : null}
      </Surface>
      {made !== null ? <Caption tone="muted">{'Came out more or less? Change "It made" and the recipe\'s yield learns from it.'}</Caption> : null}
      <Caption tone="muted" role="heading" style={styles.eyebrow}>LABEL</Caption>
      <LabelCard label={label} />
    </View>
  );
}

function Row({ label, value, strong, last }: { label: string; value: string; strong?: boolean; last?: boolean }) {
  const ds = useDs();
  return (
    <View style={[styles.row, { borderBottomColor: last ? 'transparent' : ds.c.line }]}>
      <Body>{label}</Body>
      {strong ? <Body style={styles.value}>{value}</Body> : <Body tone="muted" style={styles.value}>{value}</Body>}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  center: { alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: space.xs, borderRadius: radius.control, paddingHorizontal: space.md, minHeight: layout.minTapTarget },
  input: { width: 64, textAlign: 'right', minHeight: layout.minTapTarget },
  tick: { width: 52, height: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  facts: { paddingVertical: 0 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  value: { flexShrink: 1, textAlign: 'right' },
  eyebrow: { fontFamily: fontFamilies.mono, letterSpacing: 1 },
});
