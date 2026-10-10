import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, PressableScale, useDs } from '@/components/ds';
import { SafetyPage } from '@/components/screens/safety/SafetyPage';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useMyInvites, type MyInvite } from '@/hooks/useBarInvites';
import { useFinishOnboarding, useSaveOnboardingName, useSaveWorkplace } from '@/hooks/useOnboarding';
import { useMyProfile } from '@/hooks/useMyProfile';
import { inviteJobTitle, inviteStepLabel, needsOnboarding, nextStep, type OnboardingStep, type StepChoice } from '@/lib/onboarding';
import { stageBringInFiles } from '@/lib/bringInHandoff';
import type { ReadFile } from '@/lib/readAnything';
import { useAppMode } from '@/store/useAppMode';

import { BringStep } from './BringStep';
import { DrinkStep, FindStep, MenuStep, PlaceStep } from './CareerSteps';
import { InviteBrand, InviteWelcome } from './InviteWelcome';
import { NameStep, TasteStep, UnitsStep } from './ProfileSteps';

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
  past: { title: 'Where you’ve worked', intro: 'Your profile shows where you work now. Past jobs stay hidden unless you choose to show them.' },
  menus: { title: 'Menus you worked on', intro: 'Name the list and the bar. A closed bar is fine.' },
  drinks: {
    title: 'Cocktails you worked on',
    intro: 'A drink you made or helped make. It shows as a suggested credit. A closed bar can still be where it started.',
  },
  taste: {
    title: 'What do you like to drink?',
    intro: 'A few quick answers start your taste, for drinks picked for you. Every drink you rank sharpens it. Change them any time on You.',
  },
  units: { title: 'How do you measure?', intro: 'New specs, and the amounts you read. You can change this in Settings.' },
  bring: {
    title: 'Bring your bar in',
    intro: 'Got a spec book, a menu or a back bar? Snap it, choose photos or a PDF, or paste it, and we’ll read it in as soon as you’re set up. You check everything before it’s saved.',
  },
};

const HOME_BRING = {
  title: 'What’s on your shelf?',
  intro: 'Snap your bottles, or bring in recipes you’ve saved elsewhere. We’ll read them in as soon as you’re set up, and you check them before they’re saved.',
};

/**
 * After the age check, once, for a new account: name, work, taste and units. A
 * venue's invite comes first (InviteWelcome) and, once joined, shortens it to
 * name and units; their job at that venue is saved for them.
 */
export function OnboardingScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const profile = useMyProfile();
  const invites = useMyInvites();
  const finish = useFinishOnboarding();
  const saveProfile = useSaveOnboardingName();
  const saveJob = useSaveWorkplace();
  const enterVenue = useAppMode((s) => s.enterVenue);
  const [chosen, setStep] = useState<OnboardingStep | null>(null);
  const [joined, setJoined] = useState<MyInvite | null>(null);
  const invite = invites.data?.[0] ?? null;
  const step: OnboardingStep = chosen ?? (invite ? 'invite' : 'name');
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; handle: string } | null>(null);
  const [handleTaken, setHandleTaken] = useState(false);
  const [home, setHome] = useState(false);
  // Where setup ends: the app, or Bring in with what they handed over.
  const [landing, setLanding] = useState<'/(tabs)' | '/bring-in'>('/(tabs)');
  const personId = createdId ?? profile.data?.id ?? null;

  useEffect(() => {
    if (loading || !user) return;
    if (!needsOnboarding(user.user_metadata)) router.replace(landing);
  }, [loading, user, router, landing]);

  const go = (from: OnboardingStep, choice: StepChoice = 'no') => {
    const next = nextStep(from, choice, !!joined);
    if (next === 'done') finish.mutate();
    else setStep(next);
  };

  // A claim needs them to have no profile yet, so the profile is created only
  // once they aren't taking an existing one.
  const createProfile = (then: (id: string) => void, named = draft) => {
    if (personId) {
      then(personId);
      return;
    }
    if (!named) return;
    saveProfile.mutate(
      { name: named.name, handle: named.handle, profileId: profile.data?.id ?? null },
      {
        onSuccess: (id) => {
          setCreatedId(id);
          then(id);
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

  const saveName = (name: string, handle: string) => {
    setDraft({ name, handle });
    setHandleTaken(false);
    if (!joined) {
      go('name');
      return;
    }
    // Their job at the venue, when it has a public bar profile. A failure here
    // isn't worth stopping setup for: they can add it on their profile.
    const bar = joined.bar_profile_id;
    createProfile((id) => {
      if (!bar) go('name');
      else saveJob.mutate({ personId: id, barId: bar, title: inviteJobTitle(joined.role_level) }, { onSettled: () => go('name') });
    }, { name, handle });
  };

  const bring = (files: ReadFile[]) => {
    if (files.length) stageBringInFiles(files);
    setLanding('/bring-in');
    finish.mutate();
  };

  const copy = step === 'bring' && home ? HOME_BRING : COPY[step];
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

  if (step === 'invite' && invite) {
    return (
      <InviteWelcome
        invite={invite}
        onJoined={() => {
          setJoined(invite);
          enterVenue(invite.bar_id);
          setStep('name');
        }}
        onDeclined={() => setStep('name')}
      />
    );
  }

  const page = (
    <SafetyPage title={copy.title} intro={copy.intro} kicker={joined ? inviteStepLabel(step) : null} noBack>
      {step === 'name' ? (
        <NameStep
          // A taken handle can come back while this step is still showing (the
          // invited path saves here), so remount it to show the handle field.
          key={handleTaken ? 'handle' : 'name'}
          initialName={draft?.name || profile.data?.displayName || joined?.name || ''}
          forceHandle={handleTaken}
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
          <Answer
            label="I make drinks at home"
            onPress={() => {
              setHome(true);
              createProfile(() => setStep('taste'));
            }}
          />
          {saveProfile.error && !handleTaken ? <Caption tone="accent">{saveProfile.error.message}</Caption> : null}
        </View>
      ) : null}
      {step === 'find' && draft ? (
        <FindStep
          name={draft.name}
          pending={saveProfile.isPending}
          onClaimed={() => go('find', 'claim')}
          onNew={() => createProfile(() => go('find', 'new'))}
          onSkip={() => createProfile(() => setStep('taste'))}
        />
      ) : null}
      {step === 'work' ? <PlaceStep personId={personId} isCurrent onDone={() => go('work')} /> : null}
      {step === 'past' ? <PlaceStep personId={personId} isCurrent={false} onDone={() => go('past')} /> : null}
      {step === 'menus' ? <MenuStep personId={personId} onDone={() => go('menus')} /> : null}
      {step === 'drinks' ? <DrinkStep personId={personId} onDone={() => go('drinks')} /> : null}
      {step === 'taste' ? <TasteStep onDone={() => go('taste')} /> : null}
      {step === 'units' ? <UnitsStep onDone={() => go('units')} pending={finish.isPending} error={finish.error?.message} /> : null}
      {step === 'bring' ? <BringStep onBring={bring} onSkip={() => go('bring')} pending={finish.isPending} error={finish.error?.message} /> : null}
      {saveProfile.error && step === 'name' ? <Caption tone="accent">{saveProfile.error.message}</Caption> : null}
    </SafetyPage>
  );
  // Joined: the short setup stays in the venue's colours.
  return joined ? <InviteBrand invite={joined}>{page}</InviteBrand> : page;
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
