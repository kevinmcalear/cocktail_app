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
import { useMyClaims, useProfile } from '@/hooks/useProfiles';
import { BAR_CLAIM_METHODS, claimProblem, newClaimCode, spacedCode, type BarClaimMethod, type TypedDetails } from '@/lib/claimVerification';

/** A person checks, setup carries on: the card under the ways to check. */
function WhileYouWait({ name, typed }: { name: string; typed?: boolean }) {
  const ds = useDs();
  return (
    <View role="status">
      <Surface style={styles.status}>
        <IconSymbol name="clock" size={20} color={ds.accentText} />
        <View style={styles.flex}>
          <Body style={styles.strong}>A person checks claims, usually within a day.</Body>
          <Caption tone="muted">
            {typed ? `What you typed goes on ${name}’s page once it’s approved.` : `You can set up while you wait. Until it’s approved, ${name}’s public page stays as it is.`}
          </Caption>
        </View>
      </Surface>
    </View>
  );
}

/**
 * Step 2: prove the bar is yours. Sending makes the venue setup works on (you
 * its Admin) and claims the page for it; setup carries on while a person
 * checks (b19). The code shows before anything is sent.
 */
export function SetupClaimStep({ profileId, ensureVenue, onDone, onSkip }: { profileId: string; ensureVenue: () => Promise<string>; onDone: () => void; onSkip: () => void }) {
  const { user } = useAuth();
  const profile = useProfile(profileId).data;
  const claims = useMyClaims(profileId).data;
  const waiting = claims?.find((c) => c.status === 'pending') ?? null;
  const [code] = useState(() => newClaimCode());
  const [method, setMethod] = useState<BarClaimMethod | null>(null);
  const [typed, setTyped] = useState<TypedDetails>({});
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
      <SetupPage footer={<SetupFooter label="Keep going" onPress={onDone} />}>
        <Body>{waiting.code ? `Your claim is in. Your code is ${spacedCode(waiting.code)}.` : 'Your claim is in.'}</Body>
        <WhileYouWait name={name} />
      </SetupPage>
    );
  }

  const send = async () => {
    setProblem(null);
    setBusy(true);
    try {
      const barId = await ensureVenue();
      await start.mutateAsync({ profileId, method: chosen, barId, note: '', code, typed });
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
          label={busy ? 'Sending…' : chosen === 'email' && details.email.instant ? `Claim ${name}` : 'Send claim and keep going'}
          disabled={busy || !details[chosen].available}
          onPress={() => void send()}
          onSkip={onSkip}
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
      <WhileYouWait name={name} typed={!!details[chosen].ask && details[chosen].available} />
      <Caption tone="muted">{CLAIM_LIMIT_NOTE}</Caption>
      {problem ? (
        <Caption tone="accent" role="alert">
          {problem}
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
