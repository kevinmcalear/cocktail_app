import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useRef, useState } from 'react';

import { BringStep } from '@/components/screens/onboarding/BringStep';
import { Body, BrandProvider, Caption } from '@/components/ds';
import { SetupChromeProvider, SetupFooter, SetupPage } from '@/components/screens/onboarding/SetupPage';
import { BrandSetup } from '@/components/screens/venue/BrandScreen';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useProfile } from '@/hooks/useProfiles';
import { useVenueBrand } from '@/hooks/useVenueBrand';
import { useCreateSetupVenue, useVenueClaim, useVenuePage } from '@/hooks/useVenueSetup';
import { faceFromDb, normalizeHex, usableGroundTint } from '@/lib/brand';
import { nextScreen, previousScreen, resumeScreen, venueProgress, type ClaimState, type VenueScreen, type VenueStep } from '@/lib/venueSetup';
import type { ReadFile } from '@/lib/readAnything';
import { useAppMode } from '@/store/useAppMode';
import { useVenueSetup } from '@/store/useVenueSetup';

import { DoneMark, DoneStep } from './DoneStep';
import { FindBarStep } from './FindBarStep';
import { RoleStep } from './RoleStep';
import { SetupClaimStep } from './SetupClaimStep';
import { SetupIntro } from './SetupIntro';
import { SetupRail } from './SetupRail';
import { setupCopy } from './setupCopy';
import { TeamStep } from './TeamStep';
import { VisibilityStep } from './VisibilityStep';
import { WhereWhenStep } from './WhereWhenStep';

const BRANDED: VenueScreen[] = ['look', 'visibility', 'bring', 'team', 'done'];
const VENUE_BRING = ['Spec book PDF', 'Printed menu', 'Google Doc', 'Airtable link', 'Back bar photo'];

/**
 * Venue setup as a guided flow (b03): intro, eight steps, a summary. Opened
 * from Settings › Venues, a bar page's Claim, or Tonight's banner (?bar=, to
 * pick it up). Each step is one of the app's own pieces: the claim methods,
 * the bar facts, the Brand editor, the Publishing choice, Bring in, invites.
 */
export function VenueSetupScreen() {
  const params = useLocalSearchParams<{ bar?: string; claim?: string }>();
  const router = useRouter();
  const wide = useIsWideWeb();
  const { runs, save, markDone, rekey } = useVenueSetup();
  const [key, setKey] = useState(params.bar ?? 'new');
  // The run's key moves from 'new' to the venue mid-step (ensureVenue); steps finishing then use the new one.
  const keyRef = useRef(key);
  const run = runs[key];
  const [screen, setScreen] = useState<VenueScreen>(() => (params.claim ? 'claim' : params.bar ? resumeScreen(runs[params.bar]?.done ?? []) : 'intro'));
  const [profileOverride] = useState(params.claim ?? null);
  const profileId = profileOverride ?? run?.profileId ?? null;
  const barId = run?.barId ?? (key !== 'new' ? key : null);
  const profile = useProfile(profileId).data;
  const claim = useVenueClaim(barId).data ?? null;
  const page = useVenuePage(barId).data ?? null;
  const brand = useVenueBrand(barId ?? '').data ?? null;
  const logo = brand?.logo_url ?? null;
  const createVenue = useCreateSetupVenue();
  const enterVenue = useAppMode((s) => s.enterVenue);
  const [waitingFiles, setWaitingFiles] = useState(0);
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

  const copy = setupCopy(screen, name || 'your bar');
  const status: Partial<Record<VenueStep, string>> = {
    find: name,
    claim: claimState === 'pending' ? 'Being checked, usually within a day' : claimState === 'approved' ? 'Approved' : undefined,
    role: 'Admin',
    place: 'Typed by you',
  };
  // From the Look step on, setup wears the venue's own brand (canvas make-venue-look to make-venue-done).
  const branded = !!brand && BRANDED.includes(screen);
  const chrome = {
    title: copy.title,
    intro: copy.intro,
    eyebrow: screen === 'intro' ? 'For bars and venues' : screen === 'find' || screen === 'done' ? null : name || null,
    eyebrowTone: branded ? ('accent' as const) : ('muted' as const),
    topLabel: screen === 'intro' ? 'Venue setup' : undefined,
    // The summary has no Back: its logo with a check sits over the title instead (canvas make-venue-done).
    noBack: screen === 'done',
    mark: screen === 'done' ? <DoneMark venue={{ id: barId ?? key, name, logoUrl: logo, accent: brand?.primary_color ?? null, displayFace: faceFromDb(brand?.display_face), groundTint: null, roleLevel: 40 }} /> : undefined,
    progress: venueProgress(screen),
    onBack: screen === 'intro' ? leave : screen === 'done' ? undefined : () => setScreen(previousScreen(screen)),
    aside:
      wide && screen !== 'intro' ? (
        <SetupRail name={name} logoUrl={logo} at={screen} done={run?.done ?? []} status={status} onPick={setScreen} onLeave={leave} />
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
        <SetupClaimStep profileId={profileId} ensureVenue={ensureVenue} onDone={() => finish('claim')} onSkip={needVenue(() => setScreen('role'))} />
      ) : null}
      {screen === 'claim' && !profileId ? <FindBarStep onPicked={(bar) => save(key, { profileId: bar.id, name: bar.name })} onSkip={leave} /> : null}
      {screen === 'role' ? <RoleStep name={name} pending={claimState === 'pending'} onDone={needVenue(() => finish('role'))} /> : null}
      {screen === 'place' ? <WhereWhenStep profileId={page?.id ?? profileId} claim={claim} writable={writable} onDone={() => finish('place')} /> : null}
      {screen === 'look' && barId ? (
        <BrandSetup
          barId={barId}
          setup={{
            footer: ({ save: saveBrand, saving, ok }) => (
              <SetupFooter pending={saving} disabled={!ok} onPress={() => saveBrand(() => finish('look'))} onSkip={() => setScreen('visibility')} />
            ),
          }}
        />
      ) : null}
      {screen === 'visibility' ? <VisibilityStep barId={barId} name={name} claim={claim} writable={writable} onDone={() => finish('visibility')} /> : null}
      {screen === 'bring' ? (
        <BringStep
          examples={VENUE_BRING}
          note="Photos and PDFs are read by AI. Clean text is read on your phone. You check every drink before it’s saved, and anything from here starts private to your team."
          barId={barId}
          onFiles={(files: ReadFile[]) => setWaitingFiles((n) => n + files.length)}
          onPaste={() => router.push('/bring-in' as Href)}
          later="Bring more in later from the + button."
          footer={<SetupFooter onPress={() => finish('bring')} onSkip={() => setScreen('team')} />}
        />
      ) : null}
      {screen === 'team' && barId ? <TeamStep barId={barId} name={name} pending={claimState === 'pending'} onDone={() => finish('team')} /> : null}
      {screen === 'done' && barId ? (
        <DoneStep
          barId={barId}
          profileId={page?.id ?? profileId}
          name={name}
          claim={claim}
          claimState={claimState}
          waitingFiles={waitingFiles}
          onOpen={() => {
            save(keyRef.current, { finished: true });
            enterVenue(barId);
            router.replace((waitingFiles ? '/bring-in' : '/(tabs)') as Href);
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
