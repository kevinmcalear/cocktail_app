import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Field, Spec, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import {
  cordial,
  foam,
  formatPrepAmount,
  guessPrep,
  soda,
  superJuice,
  syrup,
  type Citrus,
  type CordialRatio,
  type PrepKind,
  type PrepLine,
  type SyrupKind,
} from '@/lib/prepCalcs';

const KINDS: { value: PrepKind; label: string }[] = [
  { value: 'juice', label: 'Super juice' },
  { value: 'syrup', label: 'Syrup' },
  { value: 'foam', label: 'Foam' },
  { value: 'cordial', label: 'Cordial' },
  { value: 'soda', label: 'Soda' },
];

const CITRUS: { value: Citrus; label: string }[] = [
  { value: 'lemon', label: 'Lemon' },
  { value: 'lime', label: 'Lime' },
  { value: 'orange', label: 'Orange' },
  { value: 'grapefruit', label: 'Grapefruit' },
  { value: 'kumquat', label: 'Kumquat' },
];

const SYRUPS: { value: SyrupKind; label: string }[] = [
  { value: 'one', label: '1:1' },
  { value: 'rich', label: 'Rich' },
  { value: 'honey', label: 'Honey' },
  { value: 'agave', label: 'Agave' },
];

const RATIOS: { value: CordialRatio; label: string }[] = [
  { value: '2:1', label: '2:1' },
  { value: '3:2', label: '3:2' },
  { value: '1:1', label: '1:1' },
];

const NOTES: Record<PrepKind, string> = {
  juice: 'Weigh the peels. Acids follow that weight, and water is 16.66 times it, so the juice lands near 6% acid. Blend the peels in with the fresh juice.',
  syrup: 'By weight. 1:1 is equal sugar and water. Rich is two parts sugar to one of water. Honey and agave get water at 0.64 times their weight, about 50% sugar.',
  foam: 'Scaled from 500 g water, 3 g methylcellulose, 0.3 g xanthan gum and 20 g gum arabic. The yield is about the weight of the water.',
  cordial: 'Syrup to citrus juice. 2:1 when the syrup is already tart, 1:1 when you want it sharper. A 6% acid solution can stand in for the juice.',
  soda: '30 ml syrup and 170 ml carbonated water in each 200 ml.',
};

function Picks<T extends string>({ label, options, value, onChange }: { label: string; options: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View role="radiogroup" accessibilityLabel={label} style={styles.picks}>
      {options.map((o) => (
        <Chip key={o.value} label={o.label} selected={o.value === value} onPress={() => onChange(o.value)} />
      ))}
    </View>
  );
}

/** The ingredient calculators: one input, the batch it implies. `onApply` writes the lines onto a recipe. */
export function PrepCalc({ name, onApply, applying }: { name?: string | null; onApply?: (lines: PrepLine[]) => void; applying?: boolean }) {
  const ds = useDs();
  const guess = guessPrep(name ?? '');
  const [kind, setKind] = useState<PrepKind>(guess.kind);
  const [citrus, setCitrus] = useState<Citrus>(guess.citrus);
  const [syrupKind, setSyrupKind] = useState<SyrupKind>(guess.syrup);
  const [ratio, setRatio] = useState<CordialRatio>('2:1');
  const [amount, setAmount] = useState('');
  const n = amount.trim() ? Number(amount) : NaN;

  let lines: PrepLine[] | null = null;
  let input = 'How much you want (g)';
  if (kind === 'juice') {
    input = citrus === 'kumquat' ? 'Whole fruit (g)' : 'Peel weight (g)';
    lines = superJuice(citrus, n);
  } else if (kind === 'syrup') {
    input = 'Syrup you want (g)';
    lines = syrup(syrupKind, n);
  } else if (kind === 'foam') {
    input = 'Foam you want (g)';
    lines = foam(n);
  } else if (kind === 'cordial') {
    input = 'Cordial you want (ml)';
    lines = cordial(ratio, n);
  } else {
    input = 'Soda you want (ml)';
    lines = soda(n);
  }

  const note = kind === 'juice' && citrus === 'kumquat'
    ? `${NOTES.juice} Kumquats go in whole. Add vitamin C at 0.04% of what you strain.`
    : NOTES[kind];

  return (
    <View style={styles.block}>
      <Picks label="What you're making" options={KINDS} value={kind} onChange={setKind} />
      {kind === 'juice' ? <Picks label="Citrus" options={CITRUS} value={citrus} onChange={setCitrus} /> : null}
      {kind === 'syrup' ? <Picks label="Syrup" options={SYRUPS} value={syrupKind} onChange={setSyrupKind} /> : null}
      {kind === 'cordial' ? <Picks label="Syrup to juice" options={RATIOS} value={ratio} onChange={setRatio} /> : null}
      <Field label={input} value={amount} onChangeText={setAmount} placeholder="100" keyboardType="decimal-pad" />
      <View style={[styles.result, { backgroundColor: ds.c.raised }]}>
        <Caption tone="muted">Use</Caption>
        {lines ? lines.map((l) => (
          <View key={l.name} style={styles.line}>
            <Body>{l.name}</Body>
            <Spec>{formatPrepAmount(l.amount)} {l.unit}</Spec>
          </View>
        )) : <Spec tone="accent">…</Spec>}
        <Body tone="muted">{note}</Body>
      </View>
      {onApply ? <Button label={applying ? 'Adding…' : 'Add to recipe'} disabled={!lines || applying} onPress={() => lines && onApply(lines)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.md },
  picks: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  result: { borderRadius: radius.control, padding: space.lg, gap: space.sm },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md },
});
