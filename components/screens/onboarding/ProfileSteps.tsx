import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Chip, Field, PalateFlower, Title } from '@/components/ds';
import { TasteAnswers } from '@/components/screens/taste/TasteAnswers';
import { space } from '@/constants/tokens';
import { useSaveTasteAnswers } from '@/hooks/useFlavor';
import { QUICK_QUESTIONS, tasteHeadline, type Taste } from '@/lib/flavor';
import { MEASURE_UNITS, handleError, nameError, type MeasureUnit } from '@/lib/onboarding';
import { handleFromName } from '@/lib/profiles';
import { useSettingsStore } from '@/store/useSettingsStore';

/** Their name (and handle, if theirs was taken). */
export function NameStep({
  initialName,
  forceHandle,
  pendingFinish,
  onSaved,
  onSkip,
}: {
  initialName: string;
  forceHandle: boolean;
  pendingFinish: boolean;
  onSaved: (name: string, handle: string) => void;
  onSkip: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [handle, setHandle] = useState<string | null>(forceHandle ? handleFromName(initialName) : null);
  const [tried, setTried] = useState(false);
  const chosen = handle ?? handleFromName(name);
  const problem = tried ? nameError(name) : null;
  const handleProblem = tried && handle !== null ? handleError(handle) : undefined;

  const submit = () => {
    setTried(true);
    if (nameError(name) || (handle !== null && handleError(handle))) return;
    onSaved(name.trim(), chosen);
  };

  return (
    <View style={styles.stack}>
      <Field label="Name" value={name} onChangeText={setName} error={problem ?? undefined} autoComplete="name" maxLength={80} />
      {handle !== null ? (
        <Field
          label="Handle"
          value={handle}
          onChangeText={setHandle}
          error={handleProblem}
          hint="Letters, numbers, dots and underscores. Yours was taken."
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={31}
        />
      ) : null}
      <Button label="Continue" onPress={submit} disabled={pendingFinish} />
      <Button label="Not now" variant="ghost" onPress={onSkip} disabled={pendingFinish} />
    </View>
  );
}

/**
 * A few quick taste questions, with the palate flower growing as they're
 * answered. Skippable; a failed save doesn't hold up setup (Discover asks again).
 */
export function TasteStep({ onDone }: { onDone: () => void }) {
  const [answers, setAnswers] = useState<Taste>({});
  const save = useSaveTasteAnswers();
  const answered = Object.keys(answers).length > 0;
  const headline = tasteHeadline(answers);
  return (
    <View style={styles.stack}>
      <View style={styles.flower}>
        <PalateFlower values={answers} size={188} />
        <Title italic align="center">
          {headline ? `${headline}.` : answered ? 'Nothing stands out yet.' : 'Tap an answer to start.'}
        </Title>
      </View>
      <TasteAnswers questions={QUICK_QUESTIONS} value={answers} onChange={setAnswers} />
      {save.error ? <Caption tone="accent">{"Couldn't save your answers. Try again, or skip and answer later on You."}</Caption> : null}
      <Button
        label={save.isPending ? 'Saving…' : 'Continue'}
        disabled={!answered || save.isPending}
        onPress={() => save.mutate(answers, { onSuccess: onDone, onError: () => {} })}
      />
      <Button label="Not now" variant="ghost" onPress={onDone} disabled={save.isPending} />
    </View>
  );
}

export function UnitsStep({ onDone, pending, error }: { onDone: () => void; pending: boolean; error?: string }) {
  const specUnit = useSettingsStore((s) => s.specUnit);
  const setSpecUnit = useSettingsStore((s) => s.setSpecUnit);
  const setDefaultUnit = useSettingsStore((s) => s.setDefaultUnit);
  const [unit, setUnit] = useState<MeasureUnit>(specUnit);

  const save = () => {
    setSpecUnit(unit);
    setDefaultUnit(unit);
    onDone();
  };

  return (
    <View style={styles.stack}>
      <View role="radiogroup" accessibilityLabel="How do you measure?" style={styles.chips}>
        {MEASURE_UNITS.map((u) => (
          <Chip key={u.id} label={u.label} selected={unit === u.id} onPress={() => setUnit(u.id)} />
        ))}
      </View>
      {error ? <Caption tone="accent">{error}</Caption> : null}
      <Button label={pending ? 'Saving…' : 'Continue'} onPress={save} disabled={pending} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  flower: { alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
});
