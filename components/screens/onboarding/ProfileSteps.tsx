import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Chip, Field } from '@/components/ds';
import { space } from '@/constants/tokens';
import { MEASURE_UNITS, handleError, nameError, passwordError, type MeasureUnit } from '@/lib/onboarding';
import { handleFromName } from '@/lib/profiles';
import { useSettingsStore } from '@/store/useSettingsStore';

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
      <Button label="Continue" onPress={submit} disabled={pendingFinish} />
      <Button label="Not now" variant="ghost" onPress={onSkip} disabled={pendingFinish} />
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
});
