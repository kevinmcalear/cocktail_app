import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, Chip, DsText, Field, PalateFlower, Surface, Title } from '@/components/ds';
import { TasteAnswers } from '@/components/screens/taste/TasteAnswers';
import { fontFamilies, space } from '@/constants/tokens';
import { useSaveTasteAnswers } from '@/hooks/useFlavor';
import { QUICK_QUESTIONS, tasteHeadline, type Taste } from '@/lib/flavor';
import { MEASURE_UNITS, handleError, nameError, passwordError, type MeasureUnit } from '@/lib/onboarding';
import { convertPour } from '@/lib/drinkWizard';
import { handleFromName } from '@/lib/profiles';
import { useSettingsStore } from '@/store/useSettingsStore';

import { SetupFooter, SetupPage } from './SetupPage';

/** Their name (and handle, if theirs was taken). An account made from an invite also picks a password. */
export function NameStep({
  initialName,
  forceHandle,
  askPassword = false,
  passwordProblem,
  pendingFinish,
  onSaved,
  onSkip,
}: {
  initialName: string;
  forceHandle: boolean;
  /** An account made from an invite email picks its password here. */
  askPassword?: boolean;
  passwordProblem?: string | null;
  pendingFinish: boolean;
  onSaved: (name: string, handle: string, password: string) => void;
  onSkip: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [password, setPassword] = useState('');
  const [handle, setHandle] = useState<string | null>(forceHandle ? handleFromName(initialName) : null);
  const [tried, setTried] = useState(false);
  const chosen = handle ?? handleFromName(name);
  const problem = tried ? nameError(name) : null;
  const handleProblem = tried && handle !== null ? handleError(handle) : undefined;

  const passwordWrong = askPassword ? passwordError(password) : null;
  const submit = () => {
    setTried(true);
    if (nameError(name) || (handle !== null && handleError(handle)) || passwordWrong) return;
    onSaved(name.trim(), chosen, password);
  };

  return (
    <SetupPage footer={<SetupFooter onPress={submit} disabled={pendingFinish} onSkip={onSkip} />}>
      <Field label="Name" value={name} onChangeText={setName} error={problem ?? undefined} autoComplete="name" maxLength={80} />
      {handle === null && name.trim() ? <Caption tone="muted" style={styles.strong}>{`Your handle is @${chosen}. You can change it on You.`}</Caption> : null}
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
      {askPassword ? (
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          error={(tried ? passwordWrong : null) ?? passwordProblem ?? undefined}
          hint="To sign in on your other devices."
          secureTextEntry
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect={false}
        />
      ) : null}
    </SetupPage>
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
    <SetupPage
      footer={<SetupFooter pending={save.isPending} disabled={!answered} onPress={() => save.mutate(answers, { onSuccess: onDone, onError: () => {} })} onSkip={onDone} />}
    >
      <View style={styles.flower}>
        <PalateFlower values={answers} size={188} />
        <Title italic align="center">
          {headline ? `${headline}.` : answered ? 'Nothing stands out yet.' : 'Tap an answer to start.'}
        </Title>
      </View>
      <TasteAnswers questions={QUICK_QUESTIONS} value={answers} onChange={setAnswers} />
      <Caption tone="muted">Change them any time on You. Every drink you rank sharpens it.</Caption>
      {save.error ? <Caption tone="accent">{"Couldn't save your answers. Try again, or skip and answer later on You."}</Caption> : null}
    </SetupPage>
  );
}

/** The spec the units step shows, in whichever unit is picked. */
const PREVIEW = [
  { ml: 45, name: 'Mezcal' },
  { ml: 22.5, name: 'Lime juice' },
];

/** ml, oz or g for new specs and reading. Joined from an invite, it's the last step before the app. */
export function UnitsStep({ onDone, pending, error, joined = false }: { onDone: () => void; pending: boolean; error?: string; joined?: boolean }) {
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
    <SetupPage footer={<SetupFooter label={joined ? 'Have a look around' : 'Continue'} pending={pending} onPress={save} />}>
      <View role="radiogroup" accessibilityLabel="How do you measure?" style={styles.chips}>
        {MEASURE_UNITS.map((u) => (
          <Chip key={u.id} label={u.label} selected={unit === u.id} onPress={() => setUnit(u.id)} />
        ))}
      </View>
      {joined ? null : (
        <>
          <Surface style={styles.preview}>
            <Caption tone="muted">{`A spec in ${unit}`}</Caption>
            {PREVIEW.map((line) => {
              // Grams read the same as millilitres for a spirit or a juice: near enough to show the idea.
              const pour = unit === 'g' ? { amount: String(line.ml), unit: 'g' } : convertPour(line.ml, 'ml', unit);
              return (
                <View key={line.name} style={styles.line}>
                  <DsText variant="spec" style={styles.amount}>{`${pour.amount} ${pour.unit}`}</DsText>
                  <DsText variant="body">{line.name}</DsText>
                </View>
              );
            })}
          </Surface>
          <Caption tone="muted">Centilitres are in Settings.</Caption>
        </>
      )}
      {error ? <Caption tone="accent">{error}</Caption> : null}
    </SetupPage>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  flower: { alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  preview: { gap: space.sm },
  line: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
  amount: { minWidth: 72 },
});
