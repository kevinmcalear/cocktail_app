import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { Body, BrandProvider, Caption } from '@/components/ds';
import { SetupChromeProvider, SetupFooter, SetupPage } from '@/components/screens/onboarding/SetupPage';
import { BrandSetup } from '@/components/screens/venue/BrandScreen';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useSetBarCurrency } from '@/hooks/usePricing';
import { useProfile } from '@/hooks/useProfiles';
import { useVenueBrand } from '@/hooks/useVenueBrand';
import type { ProfileClaim } from '@/hooks/useProfiles';
import { useCreateSetupVenue, usePushHeldSetup, useVenueClaim, useVenuePage } from '@/hooks/useVenueSetup';
import { faceFromDb, normalizeHex, usableGroundTint } from '@/lib/brand';
import { nextScreen, openRun, previousScreen, venueProgress, type ClaimState, type VenueScreen, type VenueStep } from '@/lib/venueSetup';
import { useAppMode } from '@/store/useAppMode';
import { useVenueSetup } from '@/store/useVenueSetup';

import { DoneMark, DoneStep } from './DoneStep';
import { FindBarStep } from './FindBarStep';
import { StepFooter } from './GlassesStep';
import { SetupClaimStep } from './SetupClaimStep';
import { SetupIntro } from './SetupIntro';
import { SetupRail } from './SetupRail';
import { setupCopy } from './setupCopy';
import { TeamStep } from './TeamStep';
import { VisibilityStep } from './VisibilityStep';
import { WhereWhenStep } from './WhereWhenStep';

const BRANDED: VenueScreen[] = ['look', 'visibility', 'team', 'done'];

/**
 * Venue setup as a guided flow (b03): intro, finding the bar, four steps,
 * then "Set up <bar>", the checklist. Opened from Settings › Venues (the setup already started, if
 * there is one), a bar page's Claim or Setup's owner path (?claim=, straight
 * to Where and when), or the Setup banner on Tonight or Library (?bar=, to
 * pick it up; &step=claim to prove it's yours). Each step is one of the app's
 * own pieces: the bar facts, the Brand editor, the Publishing choice,
 * invites. Every step works without a claim; proving it's yours is the card
 * under the checklist (Eddie E32), which opens the claim methods here with
 * &step=claim, and they come back to it.
 */
export function VenueSetupScreen() {
  const params = useLocalSearchParams<{ bar?: string; claim?: string; step?: string }>();
  const router = useRouter();
  const wide = useIsWideWeb();
  const { runs, save, markDone, rekey, hold } = useVenueSetup();
  const [opened] = useState(() => openRun(params, runs));
  const [key, setKey] = useState(opened.key);
  // The run's key moves from 'new' to the venue mid-step (ensureVenue); steps finishing then use the new one.
  const keyRef = useRef(key);
  const run = runs[key];
  const [screen, setScreen] = useState<VenueScreen>(opened.screen);
  // Opened cold, the saved runs load after the first render: pick up from them once they do, unless they've moved on.
  const hydrated = useSyncExternalStore(useVenueSetup.persist.onFinishHydration, useVenueSetup.persist.hasHydrated, () => false);
  const [picked, setPicked] = useState(false);
  if (!picked && hydrated) {
    setPicked(true);
    const at = screen === opened.screen ? openRun(params, runs) : { key, screen };
    setKey(at.key);
    setScreen(at.screen);
  }
  useEffect(() => {
    keyRef.current = key;
  }, [key]);
  // A claimed bar with no run of its own starts one, already found; a run left for another bar starts over.
  // Once, as setup opens: later the run moves from 'new' to its venue (ensureVenue), which mustn't start another.
  const seeded = useRef(false);
  useEffect(() => {
    if (!picked || seeded.current) return;
    seeded.current = true;
    if (params.claim && useVenueSetup.getState().runs[key]?.profileId !== params.claim) save(key, { profileId: params.claim, barId: null, name: '', done: ['find'], finished: false, held: undefined });
  }, [picked, params.claim, key, save]);
  // Opened straight onto the claim (Venue settings, Tonight, the checklist's card): Back leaves, not to the team step.
  const [claimBack, setClaimBack] = useState(screen === 'claim');
  // At the end, setup is through: "Set up <bar>" takes over (lib/setupChecklist.ts).
  useEffect(() => {
    if (screen === 'done') save(keyRef.current, { finished: true });
  }, [screen, save]);
  const [profileOverride] = useState(params.claim ?? null);
  const profileId = profileOverride ?? run?.profileId ?? null;
  const barId = run?.barId ?? (key !== 'new' ? key : null);
  const profile = useProfile(profileId).data;
  const claimQuery = useVenueClaim(barId);
  const pageQuery = useVenuePage(barId);
  const claim = claimQuery.data ?? null;
  const page = pageQuery.data ?? null;
  // Steps 3 and 5 pick where an edit goes (the page, the claim, or kept here) from these, so they wait for them.
  const settled = !claimQuery.isLoading && !pageQuery.isLoading;
  const brand = useVenueBrand(barId ?? '').data ?? null;
  const logo = brand?.logo_url ?? null;
  const createVenue = useCreateSetupVenue();
  const saveCurrency = useSetBarCurrency();
  const pushHeld = usePushHeldSetup();
  const enterVenue = useAppMode((s) => s.enterVenue);
  const name = profile?.display_name ?? run?.name ?? '';
  const claimState: ClaimState = page || claim?.status === 'approved' ? 'approved' : claim?.status === 'pending' ? 'pending' : 'none';
  const writable = !!page;

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)' as Href));
  const finish = (step: VenueStep) => {
    markDone(keyRef.current, step);
    setScreen(nextScreen(step));
  };
  // The venue setup works on: made once, from the bar's name, when the claim goes (or is skipped).
  const ensureVenue = async (): Promise<string> => {
    if (barId) return barId;
    const id = await createVenue.mutateAsync(name || 'My bar');
    rekey(keyRef.current, id);
    save(id, { barId: id, profileId, name });
    keyRef.current = id;
    setKey(id);
    return id;
  };

  // After the claim, back where it was opened (the checklist's card, the banner); with nowhere to go back to, the checklist.
  const leaveClaim = (sent: boolean) => {
    if (sent) markDone(keyRef.current, 'claim');
    if (claimBack && router.canGoBack()) return router.back();
    setScreen('done');
    setClaimBack(false);
  };
  // What steps 3 and 5 kept before the claim goes onto it, then off the device.
  const afterSend = async (sent: ProfileClaim) => {
    const kept = useVenueSetup.getState().runs[keyRef.current]?.held;
    if (!kept) return;
    await pushHeld.mutateAsync({ claim: sent, held: kept });
    hold(keyRef.current, null);
  };

  const copy = setupCopy(screen, name || 'your bar', claimState);
  const status: Partial<Record<VenueStep, string>> = { find: name, place: 'Typed by you' };
  // From the Look step on, setup wears the venue's own brand (canvas make-venue-look to make-venue-done).
  const branded = !!brand && BRANDED.includes(screen);
  const chrome = {
    title: copy.title,
    // On a phone How it looks goes straight to its pinned preview (E34).
    intro: screen === 'look' && !wide ? undefined : copy.intro,
    eyebrow: screen === 'intro' ? 'For bars and venues' : screen === 'find' || screen === 'done' ? null : name || null,
    eyebrowTone: branded ? ('accent' as const) : ('muted' as const),
    topLabel: screen === 'intro' ? 'Venue setup' : undefined,
    // The summary has no Back: its logo with a check sits over the title instead (canvas make-venue-done).
    noBack: screen === 'done',
    mark: screen === 'done' ? <DoneMark venue={{ id: barId ?? key, name, logoUrl: logo, accent: brand?.primary_color ?? null, displayFace: faceFromDb(brand?.display_face), groundTint: null, roleLevel: 40 }} /> : undefined,
    progress: venueProgress(screen),
    onBack:
      screen === 'intro' || (screen === 'claim' && claimBack) || (screen === 'place' && params.claim)
        ? leave
        : screen === 'done'
          ? undefined
          : () => setScreen(previousScreen(screen)),
    aside:
      wide && screen !== 'intro' ? (
        <SetupRail
          name={name}
          logoUrl={logo}
          at={screen}
          done={run?.done ?? []}
          status={status}
          onPick={(s) => {
            setClaimBack(false);
            setScreen(s);
          }}
          onLeave={leave}
        />
      ) : undefined,
  };
  const needVenue = (then: () => void) => () => void ensureVenue().then(then, () => {});

  const steps = (
    <SetupChromeProvider value={chrome}>
      {screen === 'intro' ? <SetupIntro onStart={() => setScreen('find')} onLeave={leave} /> : null}
      {screen === 'find' ? (
        <FindBarStep
          onPicked={(bar) => {
            save(key, { profileId: bar.id, name: bar.name });
            finish('find');
          }}
          onSkip={leave}
        />
      ) : null}
      {screen === 'claim' && profileId ? (
        <SetupClaimStep
          profileId={profileId}
          ensureVenue={ensureVenue}
          held={run?.held}
          venueError={createVenue.error?.message ?? null}
          afterSend={afterSend}
          onDone={() => leaveClaim(true)}
          onKeepPrivate={() => void ensureVenue().then(() => leaveClaim(false), () => {})}
        />
      ) : null}
      {screen === 'claim' && !profileId ? <FindBarStep onPicked={(bar) => save(key, { profileId: bar.id, name: bar.name })} onSkip={leave} /> : null}
      {(screen === 'place' || screen === 'visibility') && !settled ? <SetupPage>{null}</SetupPage> : null}
      {screen === 'place' && settled ? (
        // The venue is made here, with them as its Admin (the role step's one line), so the steps after it have one.
        <WhereWhenStep
          profileId={page?.id ?? profileId}
          barId={barId}
          name={name || 'your bar'}
          claim={claim}
          writable={writable}
          held={run?.held}
          onHold={(c) => hold(keyRef.current, c)}
          venueError={(createVenue.error ?? saveCurrency.error)?.message ?? null}
          making={createVenue.isPending || saveCurrency.isPending}
          onDone={(currency) =>
            void ensureVenue()
              .then((id) => (currency ? saveCurrency.mutateAsync({ barId: id, currency }) : undefined))
              .then(() => finish('place'), () => {})
          }
        />
      ) : null}
      {screen === 'look' && barId ? (
        <BrandSetup
          barId={barId}
          setup={{
            // A phone walks Logo, Colour, Font and Ground tint (E34): Next until the last, Back after the first.
            footer: ({ save: saveBrand, saving, ok, page }) =>
              page ? (
                <StepFooter
                  skip={page.at === 0 ? 'Not now' : 'Back'}
                  onSkip={page.at === 0 ? () => setScreen('visibility') : page.onBack}
                  label={page.next ? `Next: ${page.next}` : saving ? 'Saving…' : 'Continue'}
                  onPress={page.next ? page.onNext : () => saveBrand(() => finish('look'))}
                  disabled={!page.next && (!ok || saving)}
                />
              ) : (
                <SetupFooter pending={saving} disabled={!ok} onPress={() => saveBrand(() => finish('look'))} onSkip={() => setScreen('visibility')} />
              ),
          }}
        />
      ) : null}
      {screen === 'visibility' && settled ? (
        <VisibilityStep barId={barId} name={name} claim={claim} writable={writable} held={run?.held} onHold={(c) => hold(keyRef.current, c)} onDone={() => finish('visibility')} />
      ) : null}
      {screen === 'team' && barId ? <TeamStep barId={barId} name={name} pending={claimState === 'pending'} onDone={() => finish('team')} /> : null}
      {screen === 'done' && barId ? (
        <DoneStep
          barId={barId}
          name={name}
          onOpen={() => {
            enterVenue(barId);
            router.replace('/(tabs)' as Href);
          }}
        />
      ) : null}
      {(screen === 'look' || screen === 'team' || screen === 'done') && !barId ? (
        // Picked from the rail before the venue exists: make it first.
        <SetupPage footer={<SetupFooter label={createVenue.isPending ? 'Making it…' : `Make ${name || 'the venue'}`} pending={createVenue.isPending} onPress={needVenue(() => undefined)} />}>
          <Body tone="muted">{`This step works on your venue. We’ll make ${name || 'it'} with you as its Admin.`}</Body>
          {createVenue.error ? <Caption tone="accent">{createVenue.error.message}</Caption> : null}
        </SetupPage>
      ) : null}
    </SetupChromeProvider>
  );
  if (!branded || !brand) return steps;
  return (
    <BrandProvider
      accent={normalizeHex(brand.primary_color ?? '') ?? undefined}
      displayFace={faceFromDb(brand.display_face)}
      groundTint={usableGroundTint(normalizeHex(brand.ground_tint ?? '')) ?? undefined}
      accentText={brand.accent_text ?? undefined}
    >
      {steps}
    </BrandProvider>
  );
}
