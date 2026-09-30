import { getLocales } from 'expo-localization';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, Field, Headline, PressableScale, useDs } from '@/components/ds';
import { Choice } from '@/components/screens/menus/MenuSheet';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useConfirmAge } from '@/hooks/useAgeCheck';
import { countryName, searchCountries } from '@/lib/countries';
import { localeCountry, parseBirthDate } from '@/lib/safety';

/**
 * Birth date and country, checked against that country's drinking age. Only
 * the outcome is kept. The caller shows what happens next: the check's query
 * updates to 'confirmed' or 'under_age'.
 */
export function AgeCheckForm() {
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [country, setCountry] = useState<string | null>(() => localeCountry(getLocales()));
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirmAge();

  const submit = () => {
    const parsed = parseBirthDate(day, month, year);
    if ('error' in parsed) return setError(parsed.error);
    if (!country) return setError('Pick the country you live in.');
    setError(null);
    confirm.mutate({ birthDate: parsed.date, country });
  };

  return (
    <View style={styles.form}>
      <Body>Some of this app is about alcohol, so we check you’re of drinking age where you live. You only do this once.</Body>
      <View role="group" aria-label="Date of birth" style={styles.form}>
        <Caption tone="muted">Date of birth</Caption>
        <View style={styles.date}>
          <View style={styles.part}>
            <Field label="Day" placeholder="DD" value={day} onChangeText={setDay} keyboardType="number-pad" maxLength={2} autoComplete="birthdate-day" />
          </View>
          <View style={styles.part}>
            <Field label="Month" placeholder="MM" value={month} onChangeText={setMonth} keyboardType="number-pad" maxLength={2} autoComplete="birthdate-month" />
          </View>
          <View style={styles.year}>
            <Field label="Year" placeholder="YYYY" value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4} autoComplete="birthdate-year" />
          </View>
        </View>
      </View>
      <CountryField value={country} onChange={setCountry} />
      <Caption tone="muted">We only keep whether you’re of drinking age and the country you picked. Your birth date is never stored.</Caption>
      {error || confirm.error ? (
        <Caption tone="accent" role="alert">
          {error ?? "Couldn't check that. Check your connection and try again."}
        </Caption>
      ) : null}
      <Button label={confirm.isPending ? 'Checking…' : 'Continue'} disabled={confirm.isPending} onPress={submit} />
    </View>
  );
}

/** The country, from the device by default, with a search to change it. */
function CountryField({ value, onChange }: { value: string | null; onChange: (code: string) => void }) {
  const ds = useDs();
  const [open, setOpen] = useState(!value);
  const [query, setQuery] = useState('');
  if (!open && value) {
    return (
      <View style={styles.field}>
        <Caption tone="muted">Country you live in</Caption>
        <PressableScale
          role="button"
          accessibilityLabel={`Country you live in: ${countryName(value)}. Change`}
          onPress={() => setOpen(true)}
          style={[styles.picked, { backgroundColor: ds.c.raised, borderColor: ds.c.line }]}
        >
          <DsText variant="body" style={styles.flex}>
            {countryName(value)}
          </DsText>
          <DsText variant="caption" color={ds.accentText} style={{ fontFamily: fontFamilies.bodySemiBold }}>
            Change
          </DsText>
        </PressableScale>
      </View>
    );
  }
  const matches = searchCountries(query, 6);
  return (
    <View style={styles.field}>
      <Field label="Country you live in" placeholder="Search countries" value={query} onChangeText={setQuery} autoCorrect={false} autoComplete="country" />
      <View role="radiogroup" aria-label="Countries" style={styles.matches}>
        {matches.map((c) => (
          <Choice
            key={c.code}
            label={c.name}
            selected={c.code === value}
            onPress={() => {
              onChange(c.code);
              setQuery('');
              setOpen(false);
            }}
          />
        ))}
        {matches.length ? null : <Caption tone="muted">No country by that name.</Caption>}
      </View>
    </View>
  );
}

/** What an under-age answer means. It's final on this account. */
export function UnderAgeNote() {
  return (
    <View style={styles.form} role="status">
      <Headline role="heading">Thanks for being honest</Headline>
      <Body>
        You’re under the drinking age where you live, so collecting drinks, ranking them and publishing your own aren’t available on this account.
      </Body>
      <Body tone="muted">We kept only that answer, not your birth date. If it was a mistake, contact us at the address in our privacy policy.</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.md },
  field: { gap: space.xs },
  date: { flexDirection: 'row', gap: space.sm },
  part: { flex: 2 },
  year: { flex: 3 },
  flex: { flex: 1 },
  matches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  picked: {
    minHeight: layout.minTapTarget,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
});
