import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AllergenList } from '@/components/allergens/AllergenList';
import { Body, Button, Caption, Chip, Headline, useBreakpoint, useDs } from '@/components/ds';
import { AllergyBox } from '@/components/screens/drink/AllergyLine';
import { SafetyPage } from '@/components/screens/safety/SafetyPage';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import { useMyAllergies } from '@/hooks/useGuestAllergies';
import { useSaveMyAllergies } from '@/hooks/useSaveMyAllergies';
import { ALLERGENS, allergyMatches, type Allergen } from '@/lib/allergens';
import { allergyWarning, type AllergenRead } from '@/lib/allergenWords';

/**
 * Settings › Allergies (board Loop-allergy, "Your allergies"; desktop
 * Loop-allergy-desk): the 14 allergens to pick, private to you. Signed out
 * they stay on this phone; signed in, on your account and this phone, never
 * on a profile or shown to a bar. Drink pages warn on a match the bar has
 * checked, and never promise a drink is safe.
 */
export function AllergiesScreen() {
  const router = useRouter();
  const signedIn = useSignedIn();
  const desk = useBreakpoint() === 'desktop';
  const { data, isPending, isError, refetch } = useMyAllergies();
  const save = useSaveMyAllergies();
  const [picked, setPicked] = useState<Allergen[] | null>(null);
  const mine = picked ?? data ?? [];
  // Never set: Save with nothing picked is an answer, None, and differs from Not set.
  const dirty = data === null || (picked !== null && (picked.length !== (data ?? []).length || picked.some((a) => !(data ?? []).includes(a))));
  const toggle = (key: Allergen) => setPicked(mine.includes(key) ? mine.filter((k) => k !== key) : [...mine, key]);
  const done = () => (router.canGoBack() ? router.back() : router.replace(signedIn ? '/settings' : '/'));
  const onSave = () => (dirty ? save.mutate(mine, { onSuccess: done }) : done());
  const saveButton = <Button label={save.isPending ? 'Saving…' : 'Save'} icon="checkmark" size="sm" disabled={save.isPending || isPending} onPress={onSave} />;
  // Signed out on the web the page wears the site's chrome, which has no top-right slot: Save goes under the list.
  const inline = Platform.OS === 'web' && !signedIn;

  const form = (
    <View style={styles.form}>
      {isError && data === undefined ? (
        <View role="alert" style={styles.form}>
          <Body tone="muted">Couldn’t load your allergies. Check your connection and try again.</Body>
          <Button label="Try again" variant="secondary" size="sm" onPress={() => void refetch()} />
        </View>
      ) : (
        <View role="group" aria-label="Your allergies" style={styles.chips}>
          {ALLERGENS.map((a) => (
            <Chip key={a.key} multi quiet label={a.label} selected={mine.includes(a.key)} disabled={isPending} onPress={() => toggle(a.key)} />
          ))}
        </View>
      )}
      <PrivateNote signedIn={signedIn} />
      {save.isError ? (
        <Caption tone="accent" role="alert">
          Couldn’t save. Check your connection and try again.
        </Caption>
      ) : null}
      {inline ? <View style={styles.inlineSave}>{saveButton}</View> : null}
    </View>
  );

  return (
    <SafetyPage
      title="Your allergies"
      intro="We warn you on a drink the bar has checked. We never promise a drink is safe, so always tell your bartender."
      action={saveButton}
      crumbs={[
        { label: 'You', href: '/you' },
        { label: 'Settings', href: '/settings' },
      ]}
      frameWidth={desk ? 'wide' : 'text'}
    >
      {desk ? (
        <View style={styles.panes}>
          <View style={styles.left}>{form}</View>
          <Example mine={mine} />
        </View>
      ) : (
        form
      )}
    </SafetyPage>
  );
}

function PrivateNote({ signedIn }: { signedIn: boolean }) {
  const ds = useDs();
  return (
    <View role="note" style={[styles.note, { backgroundColor: ds.c.raised }]}>
      <IconSymbol name="lock.fill" size={16} color={ds.c.muted} />
      <Caption style={styles.flex}>
        {signedIn ? 'Private: on your account and this phone. Never on your profile, never shown to a bar.' : 'Private: kept on this phone. Sign in and it comes with you.'}
      </Caption>
    </View>
  );
}

// An example drink for the desktop's second pane: how a checked drink reads with what's picked.
const CLOVER: AllergenRead = {
  allergens: [
    { allergen: 'eggs', via: [['Egg white']] },
    { allergen: 'sulphites', via: [['Dry vermouth']] },
  ],
  unchecked: 0,
  lines: 5,
  checked: new Date().toISOString(),
};

/** Desktop (Loop-allergy-desk): beside the list, how a drink page reads with it, live as you pick. */
function Example({ mine }: { mine: Allergen[] }) {
  const ds = useDs();
  const warning = allergyWarning(allergyMatches(mine, { allergens: CLOVER.allergens, checked_at: CLOVER.checked }));
  return (
    <View aria-label="How a drink reads" style={[styles.example, { backgroundColor: ds.c.raised, borderColor: ds.c.line }]}>
      <Caption tone="muted">How a drink reads · an example</Caption>
      <Headline role="heading" aria-level={2}>
        Clover Club
      </Headline>
      {warning ? <AllergyBox title={warning.title} body={warning.body} aside="Your allergies" hit /> : null}
      <AllergenList read={CLOVER} barName="the bar" />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.control },
  flex: { flex: 1 },
  inlineSave: { alignItems: 'flex-start' },
  panes: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xxl },
  left: { width: 560, maxWidth: '50%' },
  example: { flex: 1, gap: space.md, padding: space.xl, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth },
});
