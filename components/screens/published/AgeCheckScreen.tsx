import { getLocales } from 'expo-localization';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Display, Field, GlassButton, useDs, useGutter } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useAgeCheck, useConfirmAge } from '@/hooks/useCollection';
import { parseDay } from '@/lib/collection';

/**
 * The age check, before collecting drinks: a birth date and a country, checked
 * by confirm_age, which keeps only the outcome. ponytail: a stand-in so
 * Collect works end to end; the age gate screen from its own step replaces
 * this route (keep the /age-check path, or point CollectButton at the new one).
 */
export function AgeCheckScreen() {
  return (
    <BackbarTheme>
      <AgeCheck />
    </BackbarTheme>
  );
}

function AgeCheck() {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const { data: status } = useAgeCheck();
  const confirm = useConfirmAge();
  const [birthDate, setBirthDate] = useState('');
  const [country, setCountry] = useState(() => getLocales()[0]?.regionCode ?? '');
  const [error, setError] = useState<string | null>(null);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const submit = async () => {
    const day = parseDay(birthDate);
    if (!day) return setError('Use a date like 1990-04-21.');
    if (!/^[A-Za-z]{2}$/.test(country.trim())) return setError('Use your country’s two-letter code, like US or GB.');
    setError(null);
    try {
      const age = await confirm.mutateAsync({ birthDate: day, countryCode: country.trim().toUpperCase() });
      if (age !== null) back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t check that. Try again.');
    }
  };

  const underAge = status === 'under_age' || (confirm.isSuccess && confirm.data === null);
  return (
    <ScrollView
      style={{ backgroundColor: ds.c.ground }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxxl }]}
    >
      <GlassButton icon="chevron.left" accessibilityLabel="Back" onPress={back} />
      <Display>Confirm your age</Display>
      {underAge ? (
        <Body tone="muted">Collecting drinks is for people of drinking age where they live. You can still look around.</Body>
      ) : (
        <View style={styles.form}>
          <Body tone="muted">Collecting drinks needs you to be of drinking age where you live. We keep only the result, never your date of birth.</Body>
          <Field label="Date of birth" value={birthDate} onChangeText={setBirthDate} placeholder="1990-04-21" autoCapitalize="none" />
          <Field label="Country" value={country} onChangeText={setCountry} placeholder="US" autoCapitalize="characters" maxLength={2} hint="Two letters, like US or GB." />
          {error ? <Body tone="accent">{error}</Body> : null}
          <Button label={confirm.isPending ? 'Checking…' : 'Confirm'} size="lg" onPress={submit} disabled={confirm.isPending} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: space.lg },
  form: { gap: space.md },
});
