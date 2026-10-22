import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, Segmented, Surface, Title, useDs } from '@/components/ds';
import { fontFamilies, space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useStartBarClaim } from '@/hooks/useBarClaims';
import { useBarFacts } from '@/hooks/useBarFacts';
import type { Profile, ProfileClaim } from '@/hooks/useProfiles';
import { BAR_CLAIM_METHODS, claimProblem, newClaimCode, type BarClaimMethod, type TypedDetails } from '@/lib/claimVerification';

import { ClaimMethods, methodDetails } from './ClaimMethods';

const NEW_VENUE = 'new';

/** "Up to 3 claims a day…": under the ways to check, on every claim screen. */
export const CLAIM_LIMIT_NOTE = 'Up to 3 claims a day. If we can’t confirm it, we tell you why and you can try another way.';

/** A bar's claim screen opened from its page (or a company's): how we check, then send. Venue setup has its own step. */
export function ClaimStart({ profile, declined }: { profile: Profile; declined: ProfileClaim | null }) {
  const ds = useDs();
  const { user } = useAuth();
  const adminVenues = useActiveVenue().venues.filter((v) => v.roleLevel >= 40);
  const [typed, setTyped] = useState<TypedDetails>({});
  const pagePhone = useBarFacts(profile.kind === 'bar' ? profile.id : null).data?.phone ?? null;
  const details = methodDetails(profile, user?.email_confirmed_at ? user.email : null, typed, pagePhone);
  // From a bar's page the quickest way that works is picked first (an instant work email); setup leads with Instagram (b19).
  const [method, setMethod] = useState<BarClaimMethod>(() => (details.email.available ? 'email' : (BAR_CLAIM_METHODS.find((m) => details[m].available) ?? BAR_CLAIM_METHODS[0])));
  const [code] = useState(() => newClaimCode());
  const [venue, setVenue] = useState(NEW_VENUE);
  const start = useStartBarClaim();
  const name = profile.display_name;

  const submit = () => start.mutate({ profileId: profile.id, method, barId: venue === NEW_VENUE ? null : venue, note: '', code, typed });
  const pick = (m: BarClaimMethod) => {
    setMethod(m);
    start.reset();
  };

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Caption style={[styles.strong, { color: ds.accentText }]}>{name}</Caption>
        <Title>Prove it’s yours</Title>
        <Body tone="muted">
          {profile.kind === 'bar'
            ? `Show us you work at ${name} and the page is yours: its drinks, its team, and who sees its specs.`
            : `Show us you work at ${name} and the page is yours: you run it and its team.`}
        </Body>
      </View>

      {declined ? (
        <Surface style={[styles.declined, { borderColor: ds.c.lineStrong }]}>
          <Headline role="heading">Your last claim wasn’t approved</Headline>
          <Body tone="muted">{declined.decline_reason ?? 'A moderator couldn’t confirm it.'}</Body>
          <Caption tone="muted">Try again below, or pick another way.</Caption>
        </Surface>
      ) : null}

      <ClaimMethods profile={profile} details={details} method={method} code={code} typed={typed} disabled={start.isPending} onPick={pick} onType={setTyped} />

      {/* An Admin of a venue with no page yet can link that venue instead of making a new one. */}
      {adminVenues.length ? (
        <View style={styles.group}>
          <Caption tone="muted">Which venue runs it</Caption>
          <Segmented
            accessibilityLabel="Which venue runs it"
            options={[{ value: NEW_VENUE, label: 'A new venue' }, ...adminVenues.map((v) => ({ value: v.id, label: v.name }))]}
            value={venue}
            onChange={setVenue}
          />
        </View>
      ) : null}

      <Caption tone="muted">{CLAIM_LIMIT_NOTE}</Caption>
      {start.error ? (
        <Caption tone="accent" role="alert">
          {claimProblem(start.error)}
        </Caption>
      ) : null}
      <Button label={start.isPending ? 'Sending…' : method === 'email' && details.email.instant ? `Claim ${name}` : 'Send claim'} size="lg" disabled={start.isPending || !details[method].available} onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: space.xl },
  header: { gap: space.sm },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  group: { gap: space.sm },
  declined: { gap: space.xs, borderWidth: 1 },
});
