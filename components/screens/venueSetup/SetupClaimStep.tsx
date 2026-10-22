import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Surface, useDs } from '@/components/ds';
import { ClaimMethods, methodDetails } from '@/components/screens/claim/ClaimMethods';
import { CLAIM_LIMIT_NOTE } from '@/components/screens/claim/ClaimStart';
import { SetupFooter, SetupPage } from '@/components/screens/onboarding/SetupPage';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useStartBarClaim } from '@/hooks/useBarClaims';
import { useBarFacts } from '@/hooks/useBarFacts';
import { useMyClaims, useProfile, type ProfileClaim } from '@/hooks/useProfiles';
import { BAR_CLAIM_METHODS, claimProblem, newClaimCode, spacedCode, type BarClaimMethod, type TypedDetails } from '@/lib/claimVerification';
import type { HeldSetup } from '@/store/useVenueSetup';

/** A person checks, the venue works meanwhile: the card once the claim is in. */
function WhileYouWait({ name }: { name: string }) {
  const ds = useDs();
  return (
    <View role="status">
      <Surface style={styles.status}>
        <IconSymbol name="clock" size={20} color={ds.accentText} />
        <View style={styles.flex}>
          <Body style={styles.strong}>A person checks claims, usually within a day.</Body>
          <Caption tone="muted">{`Your team can use everything meanwhile. What you set up goes on ${name}’s public page once it’s approved.`}</Caption>
        </View>
      </Surface>
    </View>
  );
}

interface Props {
  profileId: string;
  ensureVenue: () => Promise<string>;
  /** Typed in step 3: fills the ways that need the bar's Instagram, website or phone (#714). */
  held: HeldSetup | undefined;
  /** Making the venue failed (Keep it private makes it too). */
  venueError: string | null;
  /** Puts what setup held onto the claim once it exists. */
  afterSend: (claim: ProfileClaim) => Promise<void>;
  onDone: () => void;
  /** Keep it private for now: setup finishes without a claim. */
  onKeepPrivate: () => void;
}

/**
 * Step 8, the last: prove the bar is yours (Eddie call, 22 Oct). Sending
 * claims the page for the venue setup made (you its Admin); what setup held
 * goes onto the claim and on the page once a person checks it (b19). The
 * code shows before anything is sent. Keeping it private is a real choice:
 * the venue works for the team, and the page stays as it was.
 */
export function SetupClaimStep({ profileId, ensureVenue, held, venueError, afterSend, onDone, onKeepPrivate }: Props) {
  const { user } = useAuth();
  const profile = useProfile(profileId).data;
  const claims = useMyClaims(profileId).data;
  // Sent here: kept so a claim approved on the spot still moves on if keeping the setup on it failed.
  const [sent, setSent] = useState<ProfileClaim | null>(null);
  const waiting = claims?.find((c) => c.status === 'pending') ?? sent;
  const [code] = useState(() => newClaimCode());
  const [method, setMethod] = useState<BarClaimMethod | null>(null);
  const [typed, setTyped] = useState<TypedDetails>(() => ({ instagram: held?.instagram ?? undefined, website: held?.website ?? undefined, phone: held?.phone ?? undefined }));
  const pagePhone = useBarFacts(profileId).data?.phone ?? null;
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const start = useStartBarClaim();
  if (!profile) return <SetupPage><Caption tone="muted">Loading…</Caption></SetupPage>;

  const name = profile.display_name;
  const details = methodDetails(profile, user?.email_confirmed_at ? user.email : null, typed, pagePhone);
  // A page with nothing to check against leads with Instagram (b19), asking for its handle.
  const chosen = method ?? BAR_CLAIM_METHODS.find((m) => details[m].available) ?? BAR_CLAIM_METHODS[0];

  // Already sent from here or the bar's page: where it stands, and on.
  if (waiting) {
    return (
      <SetupPage footer={<SetupFooter label="Keep going" pending={busy} onPress={onDone} />}>
        <Body>{waiting.code ? `Your claim is in. Your code is ${spacedCode(waiting.code)}.` : 'Your claim is in.'}</Body>
        {waiting.status === 'pending' ? <WhileYouWait name={name} /> : null}
        {problem ? (
          <Caption tone="accent" role="alert">
            {problem}
          </Caption>
        ) : null}
      </SetupPage>
    );
  }

  const send = async () => {
    setProblem(null);
    setBusy(true);
    try {
      const barId = await ensureVenue();
      const claim = await start.mutateAsync({ profileId, method: chosen, barId, note: '', code, typed });
      setSent(claim);
      try {
        await afterSend(claim);
      } catch (e) {
        setProblem(`Your claim is in, but what you typed in setup didn’t save: ${e instanceof Error ? e.message : 'try again'}. Add it again in step 3.`);
        return;
      }
      onDone();
    } catch (e) {
      setProblem(claimProblem(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SetupPage
      footer={
        <SetupFooter
          label={busy ? 'Sending…' : 'Send claim'}
          disabled={busy || !details[chosen].available}
          onPress={() => void send()}
          skipLabel="Keep it private for now"
          onSkip={onKeepPrivate}
        />
      }
    >
      <ClaimMethods
        profile={profile}
        details={details}
        method={chosen}
        code={code}
        typed={typed}
        disabled={busy}
        onPick={setMethod}
        onType={(t) => {
          // Typing settles the way, so it can't move once the page's phone loads.
          setMethod(chosen);
          setTyped(t);
        }}
      />
      <Caption tone="muted">{CLAIM_LIMIT_NOTE}</Caption>
      {problem || venueError ? (
        <Caption tone="accent" role="alert">
          {problem ?? venueError}
        </Caption>
      ) : null}
    </SetupPage>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  flex: { flex: 1, minWidth: 0, gap: space.xs },
  strong: { fontFamily: fontFamilies.bodySemiBold },
});
