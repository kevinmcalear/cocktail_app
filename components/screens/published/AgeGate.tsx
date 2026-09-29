import { getLocales } from 'expo-localization';
import { useState } from 'react';

import { Body, Button, Field } from '@/components/ds';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { useAgeCheck, useConfirmAge } from '@/hooks/useCollection';
import { parseDay } from '@/lib/collection';

/**
 * Collecting needs a confirmed age. `gate(action)` runs the action straight
 * away once confirmed; otherwise it asks first, in a sheet, and runs it after
 * a confirmed answer. Render `sheet` somewhere in the screen. ponytail: a
 * stand-in with the same shape as useAgeGate in the safety step (#121); once
 * that lands, use its hook and delete this file.
 */
export function useAgeGate() {
  const { data: status } = useAgeCheck();
  const [pending, setPending] = useState<{ run: () => void } | null>(null);
  const gate = (action: () => void) => (status === 'confirmed' ? action() : setPending({ run: action }));
  const sheet = pending ? (
    <AgeSheet
      onClose={() => setPending(null)}
      onConfirmed={() => {
        setPending(null);
        pending.run();
      }}
    />
  ) : null;
  return { gate, sheet, underAge: status === 'under_age' };
}

function AgeSheet({ onClose, onConfirmed }: { onClose: () => void; onConfirmed: () => void }) {
  const { data: status } = useAgeCheck();
  const confirm = useConfirmAge();
  const [birthDate, setBirthDate] = useState('');
  const [country, setCountry] = useState(() => getLocales()[0]?.regionCode ?? '');
  const [error, setError] = useState<string | null>(null);
  const underAge = status === 'under_age' || (confirm.isSuccess && confirm.data === null);

  const submit = async () => {
    const day = parseDay(birthDate);
    if (!day) return setError('Use a date like 1990-04-21.');
    if (!/^[A-Za-z]{2}$/.test(country.trim())) return setError('Use your country’s two-letter code, like US or GB.');
    setError(null);
    try {
      const age = await confirm.mutateAsync({ birthDate: day, countryCode: country.trim().toUpperCase() });
      if (age !== null) onConfirmed();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t check that. Try again.');
    }
  };

  return (
    <MenuSheet
      visible
      onClose={onClose}
      title="Confirm your age"
      subtitle={underAge ? undefined : 'Once, before you collect. We keep only the result, never your date of birth.'}
      footer={underAge ? undefined : <Button label={confirm.isPending ? 'Checking…' : 'Confirm'} size="lg" onPress={submit} disabled={confirm.isPending} />}
    >
      {underAge ? (
        <Body tone="muted">Collecting drinks is for people of drinking age where they live. You can still look around.</Body>
      ) : (
        <>
          <Field label="Date of birth" value={birthDate} onChangeText={setBirthDate} placeholder="1990-04-21" autoCapitalize="none" />
          <Field label="Country" value={country} onChangeText={setCountry} placeholder="US" autoCapitalize="characters" maxLength={2} hint="Two letters, like US or GB." />
          {error ? <Body tone="accent">{error}</Body> : null}
        </>
      )}
    </MenuSheet>
  );
}
