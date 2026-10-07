import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, PressableScale, useDs } from '@/components/ds';
import { SafetyPage } from '@/components/screens/safety/SafetyPage';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useMyInvites, type MyInvite } from '@/hooks/useBarInvites';
import { useFinishOnboarding, useSaveOnboardingName } from '@/hooks/useOnboarding';
import { useMyProfile } from '@/hooks/useMyProfile';
import { roleLabel } from '@/lib/roles';
import { inviteJobTitle, inviteStepLabel, needsOnboarding, nextStep, type OnboardingStep, type StepChoice } from '@/lib/onboarding';
import { useAppStore } from '@/store/useAppStore';

import { DrinkStep, FindStep, MenuStep, PlaceStep } from './CareerSteps';
import { InviteStep } from './InviteStep';
import { NameStep, UnitsStep } from './ProfileSteps';

const COPY: Record<OnboardingStep, { title: string; intro?: string }> = {
  invite: { title: 'You’re invited' },
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

/** Invited: the venue in the title, and the job step is about that venue. */
function inviteCopy(step: OnboardingStep, invite: MyInvite | null, joined: MyInvite | null): { title: string; intro?: string } | null {
  if (step === 'invite' && invite) {
    return {
      title: `You’re invited to ${invite.bar_name}`,
      intro: `${invite.bar_name} added you to the team as ${roleLabel(invite.role_level)}. Join, then set up your profile in three short steps.`,
    };
  }
  if (step === 'work' && joined) {
    return { title: `Your job at ${joined.bar_name}`, intro: 'It shows on your profile. Put what you do, like Bartender or Bar manager.' };
  }
  return null;
}

/**
 * After the age check, once, for a new account: name, work, and units. A
 * venue's invite comes first and, once joined, shortens it to name, their job
 * there, and units.
 */
export function OnboardingScreen() {
  const router = useRouter();
  const { user, loading, updatePassword } = useAuth();
  const profile = useMyProfile();
  const invites = useMyInvites();
  const finish = useFinishOnboarding();
  const saveProfile = useSaveOnboardingName();
  const setSelectedContextIds = useAppStore((s) => s.setSelectedContextIds);
  const markContextDefaultApplied = useAppStore((s) => s.markContextDefaultApplied);
  const [chosen, setStep] = useState<OnboardingStep | null>(null);
  const [joined, setJoined] = useState<MyInvite | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordProblem, setPasswordProblem] = useState<string | null>(null);
  const invite = invites.data?.[0] ?? null;
  const step: OnboardingStep = chosen ?? (invite ? 'invite' : 'name');
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; handle: string } | null>(null);
  const [handleTaken, setHandleTaken] = useState(false);
  const personId = createdId ?? profile.data?.id ?? null;

  useEffect(() => {
    if (loading || !user) return;
    if (!needsOnboarding(user.user_metadata)) router.replace('/(tabs)');
  }, [loading, user, router]);

  const go = (from: OnboardingStep, choice: StepChoice = 'no') => {
    const next = nextStep(from, choice, !!joined);
    if (next === 'done') finish.mutate();
    else setStep(next);
  };

  // A claim needs them to have no profile yet, so the profile is created only
  // once they aren't taking an existing one.
  const createProfile = (then: () => void, named = draft) => {
    if (personId) {
      then();
      return;
    }
    if (!named) return;
    saveProfile.mutate(
      { name: named.name, handle: named.handle, profileId: profile.data?.id ?? null },
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

  // An account made from an invite email has no password yet.
  const askPassword = !!joined && !!user?.invited_at && !passwordSaved;
  const saveName = async (name: string, handle: string, password: string) => {
    setDraft({ name, handle });
    setHandleTaken(false);
    if (!joined) {
      go('name');
      return;
    }
    if (askPassword) {
      setPasswordProblem(null);
      const { error } = await updatePassword(password);
      if (error) {
        setPasswordProblem(error.message);
        return;
      }
      setPasswordSaved(true);
    }
    createProfile(() => go('name'), { name, handle });
  };

  const copy = inviteCopy(step, invite, joined) ?? COPY[step];
  if (profile.isPending || (invites.isLoading && !chosen)) {
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
    <SafetyPage title={copy.title} intro={copy.intro} kicker={joined || step === 'invite' ? inviteStepLabel(step) : null} noBack>
      {step === 'invite' && invite ? (
        <InviteStep
          invite={invite}
          onJoined={() => {
            setJoined(invite);
            setSelectedContextIds([invite.bar_id]);
            markContextDefaultApplied();
            setStep('name');
          }}
          onDeclined={() => setStep('name')}
        />
      ) : null}
      {step === 'name' ? (
        <NameStep
          initialName={draft?.name || profile.data?.displayName || joined?.name || ''}
          forceHandle={handleTaken}
          askPassword={askPassword}
          passwordProblem={passwordProblem}
          pendingFinish={finish.isPending || saveProfile.isPending}
          onSaved={saveName}
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
      {step === 'work' ? (
        <PlaceStep
          personId={personId}
          isCurrent
          onDone={() => go('work')}
          initial={
            joined
              ? {
                  bar: joined.bar_profile_id
                    ? { id: joined.bar_profile_id, display_name: joined.bar_name, locality: null, postcode: null, city: null, country_code: null }
                    : null,
                  search: joined.bar_name,
                  role: inviteJobTitle(joined.role_level),
                }
              : undefined
          }
        />
      ) : null}
      {step === 'past' ? <PlaceStep personId={personId} isCurrent={false} onDone={() => go('past')} /> : null}
      {step === 'menus' ? <MenuStep personId={personId} onDone={() => go('menus')} /> : null}
      {step === 'drinks' ? <DrinkStep personId={personId} onDone={() => go('drinks')} /> : null}
      {step === 'units' ? <UnitsStep onDone={() => go('units')} pending={finish.isPending} error={finish.error?.message} /> : null}
      {saveProfile.error && step === 'name' ? <Caption tone="accent">{saveProfile.error.message}</Caption> : null}
    </SafetyPage>
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
  strong: { fontFamily: fontFamilies.bodySemiBold },
  answer: {
    minHeight: layout.minTapTarget,
    borderRadius: radius.card,
    borderCurve: 'continuous',
    paddingHorizontal: space.xl,
    justifyContent: 'center',
  },
});
