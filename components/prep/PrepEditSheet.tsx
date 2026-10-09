import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Field, sheetFrame, Title, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useSaveItemPrep, type PrepCardData } from '@/hooks/usePrepCard';
import { PREP_ACTIONS } from '@/lib/scale';

import { newStep, StepsEditor, type StepDraft } from './StepsEditor';
import { Choice } from '../screens/batch/BatchParts';

interface PrepEditSheetProps {
  visible: boolean;
  onClose: () => void;
  itemId: string;
  itemName: string;
  current: PrepCardData;
}

const YIELD_UNITS = [
  { value: 'ml', label: 'ml' },
  { value: 'L', label: 'L' },
  { value: 'g', label: 'g' },
  { value: 'kg', label: 'kg' },
] as const;
const KEEPS_UNITS = [
  { value: 'hours', label: 'hours' },
  { value: 'days', label: 'days' },
] as const;

type YieldUnit = (typeof YIELD_UNITS)[number]['value'];
type KeepsUnit = (typeof KEEPS_UNITS)[number]['value'];

const num = (s: string) => (s.trim() ? Number(s) : null);

/**
 * Fill in the prep card: what a batch makes, how long it keeps, how long it
 * takes, where it lives, how it's made, and the steps.
 */
export function PrepEditSheet({ visible, onClose, itemId, itemName, current }: PrepEditSheetProps) {
  const ds = useDs();
  const save = useSaveItemPrep(itemId);
  const p = current.prep;
  const hours = p?.shelf_life_hours ?? null;
  const keepsInDays = !!hours && hours % 24 === 0;
  const [yieldAmount, setYieldAmount] = useState(p?.yield_amount ? String(p.yield_amount) : '');
  const [yieldUnit, setYieldUnit] = useState<YieldUnit>((YIELD_UNITS.find((u) => u.value === p?.yield_unit)?.value ?? 'ml') as YieldUnit);
  const [keeps, setKeeps] = useState(hours ? String(keepsInDays ? hours / 24 : hours) : '');
  const [keepsUnit, setKeepsUnit] = useState<KeepsUnit>(keepsInDays || !hours ? 'days' : 'hours');
  const [leadMinutes, setLeadMinutes] = useState(p?.lead_time_minutes ? String(p.lead_time_minutes) : '');
  const [leadNote, setLeadNote] = useState(p?.lead_time_note ?? '');
  const [storage, setStorage] = useState(p?.storage ?? '');
  const [actions, setActions] = useState<string[]>(p?.actions ?? []);
  const [steps, setSteps] = useState<StepDraft[]>(
    current.steps.length ? current.steps.map((s) => newStep(s.body, s.timer_seconds ? String(Math.round(s.timer_seconds / 60)) : '')) : [newStep()]
  );
  const [error, setError] = useState<string | null>(null);

  const yieldN = num(yieldAmount);
  const keepsN = num(keeps);
  const leadN = num(leadMinutes);
  const problem =
    yieldN !== null && !(yieldN > 0)
      ? 'Yield should be more than 0.'
      : keepsN !== null && !(keepsN > 0)
        ? 'Keeps should be more than 0.'
        : leadN !== null && (leadN < 0 || !Number.isInteger(leadN))
          ? 'Lead time is whole minutes.'
          : null;

  const submit = async () => {
    if (problem) return setError(problem);
    setError(null);
    try {
      await save.mutateAsync({
        prep: {
          yield_amount: yieldN,
          yield_unit: yieldN ? yieldUnit : null,
          shelf_life_hours: keepsN ? Math.round(keepsUnit === 'days' ? keepsN * 24 : keepsN) : null,
          lead_time_minutes: leadN,
          lead_time_note: leadNote.trim() || null,
          storage: storage.trim() || null,
          actions,
        },
        steps: steps.map((s) => ({ body: s.body, timer_seconds: s.timer.trim() ? Number(s.timer) * 60 : null })),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? `Couldn't save: ${e.message}` : "Couldn't save the prep card.");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" style={[styles.scrim, { backgroundColor: ds.c.scrim }]} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: 'height' })} style={[styles.avoider, sheetFrame.scrim]}>
          <Pressable style={[styles.sheet, sheetFrame.panel, { borderColor: ds.c.lineStrong, backgroundColor: ds.c.surface }]} onPress={(e) => e.stopPropagation()}>
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              <Title>Prep card</Title>
              <Body tone="muted">{itemName}. What one batch of the recipe makes.</Body>
              <View style={styles.pair}>
                <View style={styles.flex}>
                  <Field label="Yield" value={yieldAmount} onChangeText={setYieldAmount} placeholder="750" keyboardType="decimal-pad" />
                </View>
                <Choice label="Yield unit" options={YIELD_UNITS} value={yieldUnit} onChange={setYieldUnit} />
              </View>
              <View style={styles.pair}>
                <View style={styles.flex}>
                  <Field label="Keeps for" value={keeps} onChangeText={setKeeps} placeholder="7" keyboardType="decimal-pad" />
                </View>
                <Choice label="Keeps unit" options={KEEPS_UNITS} value={keepsUnit} onChange={setKeepsUnit} />
              </View>
              <View style={styles.pair}>
                <View style={styles.flex}>
                  <Field label="Lead time (minutes)" value={leadMinutes} onChangeText={setLeadMinutes} placeholder="30" keyboardType="number-pad" hint="Hands-off time before it's ready, so the prep list can say when to start." />
                </View>
                <View style={styles.flex}>
                  <Field label="Lead time note" value={leadNote} onChangeText={setLeadNote} placeholder="24 h drip" maxLength={60} />
                </View>
              </View>
              <Field label="Storage" value={storage} onChangeText={setStorage} placeholder="Fridge, sealed" maxLength={60} />
              <Caption tone="muted">{"How it's made"}</Caption>
              <View role="group" accessibilityLabel="How it's made" style={styles.chips}>
                {PREP_ACTIONS.map((a) => (
                  <Chip key={a} label={a} selected={actions.includes(a)} onPress={() => setActions(actions.includes(a) ? actions.filter((x) => x !== a) : [...actions, a])} />
                ))}
              </View>
              <StepsEditor steps={steps} onChange={setSteps} />
              {error ? <Caption tone="accent">{error}</Caption> : null}
              <View style={styles.actions}>
                <Button label="Cancel" variant="ghost" onPress={onClose} />
                <Button label={save.isPending ? 'Saving…' : 'Save'} onPress={submit} disabled={save.isPending} />
              </View>
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1 },
  avoider: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', pointerEvents: 'box-none' },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '92%', borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet },
  body: { padding: space.xl, paddingBottom: space.xxxl, gap: space.md },
  pair: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, marginTop: space.sm },
});
