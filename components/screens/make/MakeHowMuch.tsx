import { StyleSheet, View } from 'react-native';

import { Body, Caption, Chip, Field, Segmented, Spec, Surface, Title } from '@/components/ds';
import { space } from '@/constants/tokens';
import type { ScaledLine } from '@/lib/scale';

import { BatchRow } from '../batch/BatchParts';

export type MakeMode = 'batches' | 'fill' | 'have';

export const BATCHES = [0.5, 1, 2, 3, 4, 6] as const;
/** What people fill: [ml, what it is]. */
export const FILLS = [
  [500, 'Squeeze bottle, 500 ml'],
  [750, 'Wine bottle, 750 ml'],
  [1000, 'Litre bottle'],
  [2000, 'Deli tub, 2 L'],
] as const;

interface MakeHowMuchProps {
  name: string;
  mode: MakeMode;
  onMode: (m: MakeMode) => void;
  /** The yield is a volume, so a container can be filled. */
  canFill: boolean;
  batches: number;
  onBatches: (n: number) => void;
  fill: number;
  onFill: (ml: number) => void;
  lines: { id: string; name: string }[];
  haveLine: string;
  onHaveLine: (id: string) => void;
  have: string;
  onHave: (v: string) => void;
  haveUnit: string;
  scaled: ScaledLine[];
  makes: string | null;
  hint: string | null;
}

/** Make, first screen: how much, by batches, a container to fill, or what you have of one line. */
export function MakeHowMuch(p: MakeHowMuchProps) {
  const modes = [
    { value: 'batches' as const, label: 'Batches' },
    ...(p.canFill ? [{ value: 'fill' as const, label: 'Fill a bottle' }] : []),
    { value: 'have' as const, label: 'What I have' },
  ];
  return (
    <View style={styles.stack}>
      <Caption tone="muted" style={styles.eyebrow}>{`MAKE · ${p.name.toUpperCase()}`}</Caption>
      <Title>How much?</Title>
      <Segmented options={modes} value={p.mode} onChange={p.onMode} accessibilityLabel="Scale by" />
      {p.mode === 'batches' ? (
        <View role="radiogroup" accessibilityLabel="Batches" style={styles.chips}>
          {BATCHES.map((b) => (
            <Chip key={b} label={b === 0.5 ? '½' : String(b)} selected={b === p.batches} onPress={() => p.onBatches(b)} accessibilityLabel={`${b === 0.5 ? 'Half' : b} ${b > 1 ? 'batches' : 'batch'}`} />
          ))}
        </View>
      ) : p.mode === 'fill' ? (
        <View role="radiogroup" accessibilityLabel="Fill" style={styles.chips}>
          {FILLS.map(([ml, label]) => (
            <Chip key={ml} label={label} selected={ml === p.fill} onPress={() => p.onFill(ml)} />
          ))}
        </View>
      ) : (
        <View style={styles.stack}>
          <Caption tone="muted">{"Tap the line you're short of. The rest follows it."}</Caption>
          <View role="radiogroup" accessibilityLabel="Ingredient you have" style={styles.chips}>
            {p.lines.map((l) => (
              <Chip key={l.id} label={l.name} selected={l.id === p.haveLine} onPress={() => p.onHaveLine(l.id)} />
            ))}
          </View>
          <Field label={`I have (${p.haveUnit})`} value={p.have} onChangeText={p.onHave} keyboardType="decimal-pad" hint={p.hint ?? undefined} />
        </View>
      )}
      <Surface style={styles.lines}>
        {p.scaled.map((l) => (
          <BatchRow key={l.id} ingredient={l.name} amount={l.scaled} />
        ))}
        {p.makes ? (
          <View style={styles.makes}>
            <Body tone="muted">Makes about</Body>
            <Spec>{p.makes}</Spec>
          </View>
        ) : null}
      </Surface>
      <Caption tone="muted">Times stay the same when you scale. The screen stays on while you make.</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  eyebrow: { letterSpacing: 0.6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  lines: { gap: 0 },
  makes: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: space.md },
});
