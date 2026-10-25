import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { Body, Button, Caption } from '@/components/ds';
import { SafetyPage } from '@/components/screens/safety/SafetyPage';
import { useAuth } from '@/ctx/AuthContext';
import { useMyInvites, type MyInvite } from '@/hooks/useBarInvites';
import { useFinishOnboarding, useSaveOnboardingName, useSaveWorkplace } from '@/hooks/useOnboarding';
import { useMyProfile } from '@/hooks/useMyProfile';
import { useMyPersonClaim } from '@/hooks/useProfiles';
import { inviteJobTitle, needsOnboarding, nextStep, stepProgress, type OnboardingStep, type StepChoice } from '@/lib/onboarding';
import { useAppMode } from '@/store/useAppMode';

import { BringStep } from './BringStep';
import { PlaceStep } from './CareerSteps';
import { FindStep } from './FindStep';
import { InviteBrand, InviteWelcome } from './InviteWelcome';
import { NameStep, TasteStep, UnitsStep } from './ProfileSteps';
import { SetupChromeProvider, SetupFooter, SetupPage } from './SetupPage';
import { Answer } from './SetupParts';
import { DrinkStep, MenuStep } from './WorkedSteps';
import { COPY, HOME_BRING } from './onboardingCopy';

type Resume = { chosen: OnboardingStep | null; trail: OnboardingStep[]; draft: { name: string; handle: string } | null; createdId: string | null; home: boolean };
/**
 * Where setup was, by account. A page opened from Setup that Setup's guard
 * sends back (a drink on a bar page from "Find your bar or your name")
 * mounts a new Setup, which picks up here. In memory only.
 */
const resumed = new Map<string, Resume>();
/** Starts the next setup on this device from the top (tests, and once setup is done). */
export const forgetSetupProgress = () => resumed.clear();

/**
 * After the age check, once, for a new account: name, work, taste and units. A
 * venue's invite comes first (InviteWelcome) and, once joined, shortens it to
 * name and units; their job at that venue is saved for them.
 */
export function OnboardingScreen() {
  const router = useRouter();
  // "Claim this page" on a bar page opened from here comes back with the bar (ClaimProfile).
  const { run } = useLocalSearchParams<{ run?: string }>();
  const { user, loading } = useAuth();
  const profile = useMyProfile();
  const invites = useMyInvites();
  // A claim sent from "Find your bar or your name" skips the career steps, so the bar counts the shorter way.
  const { data: personClaim } = useMyPersonClaim();
  const finish = useFinishOnboarding();
  const saveProfile = useSaveOnboardingName();
  const saveJob = useSaveWorkplace();
  const enterVenue = useAppMode((s) => s.enterVenue);
  const saved = user ? resumed.get(user.id) : undefined;
  const [chosen, setChosen] = useState<OnboardingStep | null>(saved?.chosen ?? null);
  // The steps they came through, for Back.
  const [trail, setTrail] = useState<OnboardingStep[]>(saved?.trail ?? []);
  const [joined, setJoined] = useState<MyInvite | null>(null);
  const invite = invites.data?.[0] ?? null;
  const step: OnboardingStep = chosen ?? (invite ? 'invite' : 'name');
  const [createdId, setCreatedId] = useState<string | null>(saved?.createdId ?? null);
  const [draft, setDraft] = useState<{ name: string; handle: string } | null>(saved?.draft ?? null);
  const [handleTaken, setHandleTaken] = useState(false);
  const [home, setHome] = useState(saved?.home ?? false);
  // The bar from "Where do you work?", for "Bring Little Rye in".
  const [barName, setBarName] = useState<string | null>(null);
  // Handed something to read on the last step: setup ends in Bring in, where it's being read.
  const [handed, setHanded] = useState(false);
  // Where setup ends: the app, Bring in with what they handed over, or venue setup for an owner.
  const [landing, setLanding] = useState<Href>('/(tabs)');
  const personId = createdId ?? profile.data?.id ?? null;

  useEffect(() => {
    if (loading || !user) return;
    if (needsOnboarding(user.user_metadata)) return;
    forgetSetupProgress();
    router.replace(landing);
  }, [loading, user, router, landing]);
  const userId = user?.id;
  useEffect(() => {
    if (userId && needsOnboarding(user?.user_metadata)) resumed.set(userId, { chosen, trail, draft, createdId, home });
  }, [userId, user?.user_metadata, chosen, trail, draft, createdId, home]);

  const setStep = (next: OnboardingStep) => {
    setTrail((t) => [...t, step]);
    setChosen(next);
  };
  const back = () => {
    setChosen(trail[trail.length - 1] ?? 'name');
    setTrail((t) => t.slice(0, -1));
  };
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

  // An owner, from a bar page's Claim (?run=) or "Add your bar" ('new'): their
  // profile is saved, setup ends, and venue setup takes over (it can't open while
  // setup is unfinished). Kept until then, so a name to fix first doesn't lose it.
  const [ownerBar, setOwnerBar] = useState<string | null>(null);
  const setUpBar = (bar: string, named = draft) => {
    if (saveProfile.isPending || finish.isPending) return;
    setOwnerBar(bar);
    if (!personId && !named) {
      if (step !== 'name') setStep('name');
      return;
    }
    createProfile(() => {
      setLanding((bar === 'new' ? '/venue-setup' : `/venue-setup?claim=${bar}`) as Href);
      finish.mutate();
    }, named);
  };
  const ranFor = useRef<string | null>(null);
  useEffect(() => {
    if (!run || ranFor.current === run || profile.isPending) return;
    ranFor.current = run;
    setUpBar(run);
  });

  const saveName = (name: string, handle: string) => {
    setDraft({ name, handle });
    setHandleTaken(false);
    if (ownerBar) {
      setUpBar(ownerBar, { name, handle });
      return;
    }
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

  // Finish setup: Bring in shows what it's reading; Paste opens it empty.
  const bring = (paste = false) => {
    if (handed || paste) setLanding('/bring-in');
    finish.mutate();
  };

  const copy = step === 'bring' && home ? HOME_BRING : step === 'bring' && barName ? { ...COPY.bring, title: `Bring ${barName} in` } : COPY[step];
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
          setChosen('name');
        }}
        onDeclined={() => setChosen('name')}
      />
    );
  }

  const first = trail.length === 0 && (step === 'name' || step === 'invite');
  const page = (
    <SetupChromeProvider
      value={{
        title: copy.title,
        // Invited: the venue's unit is the starting point, so no "change this in Settings".
        intro: step === 'units' && joined ? 'New specs, and the amounts you read.' : copy.intro,
        eyebrow: step === 'bring' && !home ? 'Last step' : joined ? joined.bar_name : null,
        // The invited path wears the venue's brand, its name in the accent; "Last step" is quiet.
        eyebrowTone: joined && step !== 'bring' ? 'accent' : 'muted',
        progress: stepProgress(step, !!joined, trail, step === 'find' && personClaim ? 'claim' : 'no'),
        onBack: first ? undefined : back,
      }}
    >
      {step === 'name' ? (
        <NameStep
          // A taken handle can come back while this step is still showing (the
          // invited path saves here), so remount it to show the handle field.
          key={handleTaken ? 'handle' : 'name'}
          initialName={draft?.name || profile.data?.displayName || joined?.name || ''}
          forceHandle={handleTaken}
          invited={!!joined}
          job={joined?.bar_profile_id ? { bar: joined.bar_name, title: inviteJobTitle(joined.role_level) } : null}
          pendingFinish={finish.isPending || saveProfile.isPending}
          onSaved={saveName}
          onSkip={() => finish.mutate()}
        />
      ) : null}
      {step === 'hospitality' ? (
        <SetupPage footer={<Button label="Not now" variant="ghost" onPress={() => createProfile(() => setStep('taste'))} />}>
          <Answer
            label="Yes, I work in hospitality"
            detail="Where you’ve worked, menus and drinks you made"
            onPress={() => {
              if (personId) setStep('work');
              else setStep('find');
            }}
          />
          <Answer
            label="I make drinks at home"
            detail="Straight to what you like to drink"
            onPress={() => {
              setHome(true);
              createProfile(() => setStep('taste'));
            }}
          />
          {saveProfile.error && !handleTaken ? <Caption tone="accent">{saveProfile.error.message}</Caption> : null}
        </SetupPage>
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
      {step === 'work' ? (
        <PlaceStep
          personId={personId}
          isCurrent
          onAddBar={() => setUpBar('new')}
          onDone={(bar) => {
            if (bar) setBarName(bar);
            go('work');
          }}
        />
      ) : null}
      {step === 'past' ? <PlaceStep personId={personId} isCurrent={false} onDone={() => go('past')} /> : null}
      {step === 'menus' ? <MenuStep personId={personId} onDone={() => go('menus')} /> : null}
      {step === 'drinks' ? <DrinkStep personId={personId} onDone={() => go('drinks')} /> : null}
      {step === 'taste' ? <TasteStep onDone={() => go('taste')} /> : null}
      {step === 'units' ? <UnitsStep joined={joined ? { barId: joined.bar_id, name: joined.bar_name } : null} onDone={() => go('units')} pending={finish.isPending} error={finish.error?.message} /> : null}
      {step === 'bring' ? (
        <BringStep
          barId={null}
          onFiles={() => setHanded(true)}
          onPaste={() => bring(true)}
          onLater={() => finish.mutate()}
          error={finish.error?.message}
          footer={<SetupFooter label="Finish setup" compact pending={finish.isPending} onPress={() => bring()} />}
        />
      ) : null}
      {saveProfile.error && step === 'name' ? <Caption tone="accent">{saveProfile.error.message}</Caption> : null}
      {ownerBar && finish.error ? <Caption tone="accent">{finish.error.message}</Caption> : null}
    </SetupChromeProvider>
  );
  // Joined: the short setup stays in the venue's colours.
  return joined ? <InviteBrand invite={joined}>{page}</InviteBrand> : page;
}
