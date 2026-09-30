import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BackbarTheme, Body, BrandProvider, Caption, Chip, Field, PressableScale, Segmented, Spec, Title, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import type { PrepCardData } from '@/hooks/usePrepCard';
import { toQuantity } from '@/lib/quantity';
import { factorForLine, factorForYield, factorLabel, scaledYield, scaleRecipe, type RecipeLine } from '@/lib/scale';

import { BatchRow, Choice } from '../screens/batch/BatchParts';
import { StepTimer } from './StepTimer';

interface MakeSheetProps {
  visible: boolean;
  onClose: () => void;
  itemName: string;
  recipe: RecipeLine[];
  card: PrepCardData;
  accent?: string;
}

type Mode = 'batches' | 'yield' | 'have';
const MODES = [
  { value: 'batches', label: 'Batches' },
  { value: 'yield', label: 'To yield' },
  { value: 'have', label: 'From what I have' },
] as const;
const BATCHES = [
  { value: 0.5, label: '½' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 6, label: '6' },
] as const;

/**
 * Making a prep, in the light prep theme: scale the recipe by batches, to the
 * yield you need, or from what's on the bench, then work through the steps
 * with their timers.
 */
export function MakeSheet(props: MakeSheetProps) {
  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}>
      <BackbarTheme scheme="light">
        <BrandProvider accent={props.accent}>
          <MakeBody {...props} />
        </BrandProvider>
      </BackbarTheme>
    </Modal>
  );
}

function MakeBody({ onClose, itemName, recipe, card }: MakeSheetProps) {
  const ds = useDs();
  const [mode, setMode] = useState<Mode>('batches');
  const [batches, setBatches] = useState<number>(1);
  const [target, setTarget] = useState('');
  const [haveLine, setHaveLine] = useState<string>(recipe[0]?.id ?? '');
  const [have, setHave] = useState('');
  const [done, setDone] = useState<number[]>([]);
  const prep = card.prep;

  const yieldUnit = prep?.yield_unit ?? null;
  const line = recipe.find((l) => l.id === haveLine) ?? null;
  const factor =
    mode === 'batches'
      ? batches
      : mode === 'yield'
        ? factorForYield(prep?.yield_amount ?? null, yieldUnit, toQuantity(target, yieldUnit))
        : line
          ? factorForLine(line, toQuantity(have, line.unit))
          : null;
  const lines = scaleRecipe(recipe, factor ?? 1);
  const makes = factor ? scaledYield(prep?.yield_amount ?? null, yieldUnit, factor) : null;
  const hint =
    mode === 'yield' && !prep?.yield_amount
      ? 'Set the yield on the prep card first.'
      : mode === 'yield' && target && factor === null
        ? `Enter the amount in ${yieldUnit}.`
        : mode === 'have' && have && factor === null
          ? `Enter the amount in ${line?.unit ?? 'the same unit'}.`
          : null;

  return (
    <Pressable accessibilityLabel="Close" style={[styles.scrim, { backgroundColor: ds.c.scrim }]} onPress={onClose}>
      <View style={styles.avoider} pointerEvents="box-none">
        <Pressable style={[styles.sheet, { backgroundColor: ds.c.ground }]} onPress={(e) => e.stopPropagation()}>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Caption tone="muted">Prep · make</Caption>
            <Title>{itemName}</Title>
            <Segmented options={MODES} value={mode} onChange={setMode} accessibilityLabel="How to scale" />
            {mode === 'batches' ? (
              <Choice label="Batches" options={BATCHES} value={batches} onChange={setBatches} />
            ) : mode === 'yield' ? (
              <Field label={`Make (${yieldUnit ?? 'ml'})`} value={target} onChangeText={setTarget} placeholder={prep?.yield_amount ? String(prep.yield_amount * 2) : '1500'} keyboardType="decimal-pad" hint={hint ?? undefined} />
            ) : (
              <View style={styles.have}>
                <Caption tone="muted">{"Tap the line you're short of. The rest follows."}</Caption>
                <View role="radiogroup" accessibilityLabel="Ingredient you have" style={styles.chips}>
                  {recipe.map((l) => (
                    <Chip key={l.id} label={l.name} selected={l.id === haveLine} onPress={() => setHaveLine(l.id)} />
                  ))}
                </View>
                <Field label={`You have (${line?.unit ?? ''})`} value={have} onChangeText={setHave} placeholder={line?.amount ? String(line.amount) : ''} keyboardType="decimal-pad" hint={hint ?? undefined} />
              </View>
            )}
            <View style={styles.list}>
              {lines.map((l) => (
                <BatchRow key={l.id} ingredient={l.name} amount={l.scaled} />
              ))}
            </View>
            <View style={styles.makes}>
              <Body tone="muted">{factor ? factorLabel(factor) : 'Scale not set'}</Body>
              {makes ? <Spec>Makes {makes}</Spec> : null}
            </View>
            {card.steps.length ? (
              <View style={styles.steps}>
                <Caption tone="muted">Steps</Caption>
                {card.steps.map((s) => {
                  const checked = done.includes(s.position);
                  return (
                    <View key={s.position} style={[styles.step, { borderBottomColor: ds.c.line }]}>
                      <PressableScale
                        role="checkbox"
                        aria-checked={checked}
                        accessibilityLabel={`Step ${s.position + 1}: ${s.body}`}
                        onPress={() => setDone(checked ? done.filter((p) => p !== s.position) : [...done, s.position])}
                        style={styles.check}
                      >
                        <View style={[styles.box, { borderColor: checked ? ds.c.ink : ds.c.lineStrong, backgroundColor: checked ? ds.c.ink : 'transparent' }]}>
                          {checked ? <IconSymbol name="checkmark" size={14} color={ds.c.ground} /> : null}
                        </View>
                        <Body tone={checked ? 'muted' : 'ink'} style={[styles.stepText, checked && styles.done]}>
                          {s.body}
                        </Body>
                      </PressableScale>
                      {s.timer_seconds ? <StepTimer seconds={s.timer_seconds} /> : null}
                    </View>
                  );
                })}
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1 },
  avoider: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '92%', borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet },
  body: { padding: space.xl, paddingBottom: space.xxxl, gap: space.md },
  have: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  list: {},
  makes: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md },
  steps: { gap: space.xs, marginTop: space.sm },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  check: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget },
  box: { width: 22, height: 22, borderRadius: radius.control / 2, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stepText: { flex: 1 },
  done: { textDecorationLine: 'line-through' },
});
