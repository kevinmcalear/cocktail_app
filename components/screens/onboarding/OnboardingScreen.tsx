import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Field, PressableScale, useDs } from '@/components/ds';
import { SafetyPage } from '@/components/screens/safety/SafetyPage';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useFinishOnboarding, useSaveOnboardingName } from '@/hooks/useOnboarding';
import { useMyProfile } from '@/hooks/useMyProfile';
import { handleFromName } from '@/lib/profiles';
import { MEASURE_UNITS, handleError, nameError, needsOnboarding, nextStep, type MeasureUnit, type OnboardingStep, type StepChoice } from '@/lib/onboarding';
import { useSettingsStore } from '@/store/useSettingsStore';

import { DrinkStep, FindStep, MenuStep, PlaceStep } from './CareerSteps';

const COPY: Record<OnboardingStep, { title: string; intro?: string }> = {
  name: { title: 'Your name', intro: 'How you show up on your profile and on drinks.' },
  hospitality: { title: 'Do you work in hospitality?' },
  find: {
    title: 'Do we already have you?',
    intro: 'If this is your profile, claim it. If not, you’ll add where you’ve worked, the menus, and the cocktails.',
  },
  work: {
    title: 'Where do you work?',
    intro: 'Pick a bar, even one that has closed. Picking one doesn’t open its menus. Adding a bar makes you its admin.',
  },
  past: { title: 'Anywhere else you’ve worked?', intro: 'Earlier bars count, including ones that have closed.' },
  menus: { title: 'Menus you worked on', intro: 'Name the list and the bar. A closed bar is fine.' },
  drinks: {
    title: 'Cocktails you worked on',
    intro: 'A drink you made or helped make. It shows as a suggested credit. A closed bar can still be where it started.',
  },
  units: { title: 'How do you measure?', intro: 'New specs, and the amounts you read. You can change this in Settings.' },
};

/** After the age check, once, for a new account: name, work, and units. */
export function OnboardingScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const profile = useMyProfile();
  const finish = useFinishOnboarding();
  const saveProfile = useSaveOnboardingName();
  const [step, setStep] = useState<OnboardingStep>('name');
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; handle: string } | null>(null);
  const [handleTaken, setHandleTaken] = useState(false);
  const personId = createdId ?? profile.data?.id ?? null;

  useEffect(() => {
    if (loading || !user) return;
    if (!needsOnboarding(user.user_metadata)) router.replace('/(tabs)');
  }, [loading, user, router]);

  const go = (from: OnboardingStep, choice: StepChoice = 'no') => {
    const next = nextStep(from, choice);
    if (next === 'done') finish.mutate();
    else setStep(next);
  };

  // A claim needs them to have no profile yet, so the profile is created only
  // once they aren't taking an existing one.
  const createProfile = (then: () => void) => {
    if (personId) {
      then();
      return;
    }
    if (!draft) return;
    saveProfile.mutate(
      { name: draft.name, handle: draft.handle, profileId: profile.data?.id ?? null },
      {
        onSuccess: (id) => {
          setCreatedId(id);
          then();
        },
        onError: (e) => {
          if (/handle/i.test(e.message)) {
            setHandleTaken(true);
            setStep('name');
          }
        },
      }
    );
  };

  const copy = COPY[step];
  if (profile.isPending) {
    return (
      <SafetyPage title="Welcome" noBack>
        <Body tone="muted">One moment…</Body>
      </SafetyPage>
    );
  }
  if (profile.error) {
    return (
      <SafetyPage title="Welcome" noBack>
        <Body tone="muted">Couldn’t load your account. Check your connection and try again.</Body>
        <Button label="Try again" onPress={() => profile.refetch()} />
        <Button label="Not now" variant="ghost" onPress={() => finish.mutate()} disabled={finish.isPending} />
        {finish.error ? <Caption tone="accent">{finish.error.message}</Caption> : null}
      </SafetyPage>
    );
  }

  return (
    <SafetyPage title={copy.title} intro={copy.intro} noBack>
      {step === 'name' ? (
        <NameStep
          initialName={draft?.name || profile.data?.displayName || ''}
          forceHandle={handleTaken}
          pendingFinish={finish.isPending}
          onSaved={(name, handle) => {
            setDraft({ name, handle });
            setHandleTaken(false);
            go('name');
          }}
          onSkip={() => finish.mutate()}
        />
      ) : null}
      {step === 'hospitality' ? (
        <View style={styles.stack}>
          <Answer
            label="Yes, I work in hospitality"
            onPress={() => {
              if (personId) setStep('work');
              else setStep('find');
            }}
          />
          <Answer label="I make drinks at home" onPress={() => createProfile(() => setStep('units'))} />
          {saveProfile.error && !handleTaken ? <Caption tone="accent">{saveProfile.error.message}</Caption> : null}
        </View>
      ) : null}
      {step === 'find' && draft ? (
        <FindStep
          name={draft.name}
          pending={saveProfile.isPending}
          onClaimed={() => go('find', 'claim')}
          onNew={() => createProfile(() => go('find', 'new'))}
          onSkip={() => createProfile(() => setStep('units'))}
        />
      ) : null}
      {step === 'work' ? <PlaceStep personId={personId} isCurrent onDone={() => go('work')} /> : null}
      {step === 'past' ? <PlaceStep personId={personId} isCurrent={false} onDone={() => go('past')} /> : null}
      {step === 'menus' ? <MenuStep personId={personId} onDone={() => go('menus')} /> : null}
      {step === 'drinks' ? <DrinkStep personId={personId} onDone={() => go('drinks')} /> : null}
      {step === 'units' ? <UnitsStep onDone={() => go('units')} pending={finish.isPending} error={finish.error?.message} /> : null}
      {saveProfile.error && step === 'name' ? <Caption tone="accent">{saveProfile.error.message}</Caption> : null}
    </SafetyPage>
  );
}

function NameStep({
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
      <Button label="Continue" onPress={submit} />
      <Button label="Not now" variant="ghost" onPress={onSkip} disabled={pendingFinish} />
    </View>
  );
}

function UnitsStep({ onDone, pending, error }: { onDone: () => void; pending: boolean; error?: string }) {
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

function Answer({ label, onPress }: { label: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale accessibilityLabel={label} onPress={onPress} style={[styles.answer, { backgroundColor: ds.c.raised }]}>
      <Body style={styles.strong}>{label}</Body>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  answer: {
    minHeight: layout.minTapTarget,
    borderRadius: radius.card,
    borderCurve: 'continuous',
    paddingHorizontal: space.xl,
    justifyContent: 'center',
  },
});
