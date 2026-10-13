import type { ReactNode } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Body, Caption, Chip, IngredientThumb, PressableScale, Spec, Surface, Title, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import type { ScaledLine } from '@/lib/scale';

import { stepHave } from './makeLogic';

export type MakeMode = 'batches' | 'fill' | 'have';

export const BATCHES = [0.5, 1, 2, 3] as const;
/** What people fill: ml, what it is, its size, and what the kit list calls it. */
export const FILLS = [
  { ml: 500, name: 'Squeeze bottle', size: '500 ml', container: 'Squeeze bottle' },
  { ml: 750, name: 'Wine bottle', size: '750 ml', container: '750 ml bottle' },
  { ml: 1000, name: 'Litre bottle', size: '1 L', container: '1 L bottle' },
  { ml: 2000, name: 'Deli tub', size: '2 L', container: '2 L deli tub' },
] as const;

interface MakeHowMuchProps {
  name: string;
  mode: MakeMode;
  onMode: (m: MakeMode) => void;
  /** The yield is a volume, so a container can be filled. */
  canFill: boolean;
  /** The batch tiles: ½ to 3, plus the size the page asked for when it's bigger. */
  batchOptions: readonly number[];
  batches: number;
  onBatches: (n: number) => void;
  fill: number;
  onFill: (ml: number) => void;
  lines: { id: string; name: string; ingredientId?: string | null }[];
  haveLine: string;
  onHaveLine: (id: string) => void;
  have: string;
  onHave: (v: string) => void;
  haveUnit: string;
  scaled: ScaledLine[];
  makes: string | null;
  hint: string | null;
}

/** A big choice tile: the batch count, or a container and its size. */
function Tile({ selected, onPress, label, children, wide }: { selected: boolean; onPress: () => void; label: string; children: ReactNode; wide?: boolean }) {
  const ds = useDs();
  return (
    <PressableScale role="radio" aria-checked={selected} accessibilityLabel={label} onPress={onPress} style={[styles.tile, wide ? styles.half : styles.quarter, { backgroundColor: ds.c.surface, borderColor: selected ? ds.c.ink : 'transparent' }]}>
      {children}
    </PressableScale>
  );
}

/** Batches / Fill a bottle / What I have: a pill switch on a cream track, the pick on white (prep-make-howmuch). */
function ModeSwitch({ options, value, onChange }: { options: { value: MakeMode; label: string }[]; value: MakeMode; onChange: (m: MakeMode) => void }) {
  const ds = useDs();
  return (
    <View role="tablist" accessibilityLabel="Scale by" style={[styles.switch, { backgroundColor: ds.c.raised }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <PressableScale key={o.value} role="tab" aria-selected={on} accessibilityLabel={o.label} onPress={() => onChange(o.value)} style={[styles.side, on && { backgroundColor: ds.c.surface }]}>
            <Body tone={on ? 'ink' : 'muted'} numberOfLines={1} style={on ? styles.strong : null}>
              {o.label}
            </Body>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Make, first screen: how much, by batches, a container to fill, or what you have of one line. */
export function MakeHowMuch(p: MakeHowMuchProps) {
  const ds = useDs();
  const modes = [
    { value: 'batches' as const, label: 'Batches' },
    ...(p.canFill ? [{ value: 'fill' as const, label: 'Fill a bottle' }] : []),
    { value: 'have' as const, label: 'What I have' },
  ];
  const haveLine = p.lines.find((l) => l.id === p.haveLine);
  const haveNumber = Number(p.have);
  const step = (dir: 1 | -1) => p.onHave(String(stepHave(haveNumber > 0 ? haveNumber : 0, p.haveUnit, dir)));
  return (
    <View style={styles.stack}>
      <Title>How much?</Title>
      <ModeSwitch options={modes} value={p.mode} onChange={p.onMode} />
      {p.mode === 'batches' ? (
        <View role="radiogroup" accessibilityLabel="Batches" style={styles.tiles}>
          {p.batchOptions.map((b) => (
            <Tile key={b} selected={b === p.batches} onPress={() => p.onBatches(b)} label={`${b === 0.5 ? 'Half a' : b} ${b > 1 ? 'batches' : 'batch'}`}>
              <Spec style={styles.big}>{b === 0.5 ? '½' : String(b)}</Spec>
            </Tile>
          ))}
        </View>
      ) : p.mode === 'fill' ? (
        <View role="radiogroup" accessibilityLabel="Bottle to fill" style={styles.tiles}>
          {FILLS.map((f) => (
            <Tile key={f.ml} wide selected={f.ml === p.fill} onPress={() => p.onFill(f.ml)} label={`${f.name}, ${f.size}`}>
              <Body>{f.name}</Body>
              <Caption tone="muted">{f.size}</Caption>
            </Tile>
          ))}
        </View>
      ) : (
        <View style={styles.stack}>
          {p.lines.length > 1 ? (
            <View role="radiogroup" accessibilityLabel="Ingredient you have" style={styles.chips}>
              {p.lines.map((l) => (
                <Chip key={l.id} label={l.name} selected={l.id === p.haveLine} onPress={() => p.onHaveLine(l.id)} />
              ))}
            </View>
          ) : null}
          <View style={styles.stepper}>
            <Body>I have</Body>
            <PressableScale accessibilityLabel={`Less ${haveLine?.name ?? ''}`.trim()} onPress={() => step(-1)} style={[styles.round, { backgroundColor: ds.c.raised }]}>
              <IconSymbol name="minus" size={18} color={ds.c.ink} />
            </PressableScale>
            <TextInput
              value={p.have}
              onChangeText={p.onHave}
              keyboardType="decimal-pad"
              aria-label={`How much ${haveLine?.name ?? ''} you have, in ${p.haveUnit || 'its unit'}`}
              style={[styles.amount, type.spec, { fontFamily: fontFamilies.monoMedium, color: ds.c.ink, backgroundColor: ds.c.raised }]}
            />
            <Spec>{p.haveUnit}</Spec>
            <PressableScale accessibilityLabel={`More ${haveLine?.name ?? ''}`.trim()} onPress={() => step(1)} style={[styles.round, { backgroundColor: ds.c.raised }]}>
              <IconSymbol name="plus" size={18} color={ds.c.ink} />
            </PressableScale>
            <Body tone="muted" style={styles.shrink} numberOfLines={1}>
              {haveLine?.name.toLowerCase()}
            </Body>
          </View>
          {p.hint ? <Caption tone="accent">{p.hint}</Caption> : null}
        </View>
      )}
      <Surface style={styles.lines}>
        {p.scaled.map((l) => (
          <View key={l.id} accessible accessibilityLabel={`${l.scaled} ${l.name}`} style={[styles.line, { borderBottomColor: ds.c.line }]}>
            <IngredientThumb id={p.lines.find((x) => x.id === l.id)?.ingredientId} name={l.name} />
            <Body style={styles.shrink}>{l.name}</Body>
            <Spec align="right">{l.scaled}</Spec>
          </View>
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
  switch: { flexDirection: 'row', padding: space.xs, borderRadius: radius.pill },
  side: { flex: 1, minHeight: layout.minTapTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { minHeight: 64, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 2, justifyContent: 'center' },
  quarter: { flexGrow: 1, flexBasis: '20%', alignItems: 'center' },
  half: { flexGrow: 1, flexBasis: '40%', paddingHorizontal: space.md, gap: 2 },
  big: { ...type.headline, fontFamily: fontFamilies.monoMedium },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  round: { width: layout.minTapTarget, height: layout.minTapTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  amount: { width: 88, minHeight: layout.minTapTarget, borderRadius: radius.control, textAlign: 'center' },
  shrink: { flex: 1, minWidth: 0 },
  lines: { gap: 0 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  makes: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: space.md },
});
