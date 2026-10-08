import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field, Headline, Segmented, Surface, Title, useDs } from '@/components/ds';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useStartBarClaim } from '@/hooks/useBarClaims';
import type { Profile, ProfileClaim } from '@/hooks/useProfiles';
import {
  BAR_CLAIM_METHODS,
  METHOD_COPY,
  REVIEW_REASON,
  claimProblem,
  emailCheck,
  emailUnavailable,
  pageInstagram,
  type BarClaimMethod,
} from '@/lib/claimVerification';

import { Choice } from '../menus/MenuSheet';

const NEW_VENUE = 'new';

/** Each way of checking, with whether it works for this page and this person, in words. */
function methodDetails(profile: Profile, email: string | null | undefined) {
  const check = emailCheck(email, profile.website, profile.is_closed);
  const handle = pageInstagram(profile);
  return {
    email: {
      available: check.ok !== false,
      detail:
        check.ok === 'instant'
          ? `You signed in with an address at ${check.domain}, the bar’s own website.`
          : check.ok === 'review'
            ? `You signed in at ${check.domain}. A moderator checks it, because ${REVIEW_REASON[check.reason]}.`
            : emailUnavailable(check),
      instant: check.ok === 'instant',
    },
    instagram: {
      available: !!handle,
      detail: handle ? `Put a six-digit code in @${handle}’s bio. A moderator looks, usually within a day.` : 'This page has no Instagram to check.',
      instant: false,
    },
    phone: {
      available: true,
      detail: 'We ring the bar on a number we look up ourselves and ask for a six-digit code. The slowest way.',
      instant: false,
    },
  } satisfies Record<BarClaimMethod, { available: boolean; detail: string; instant: boolean }>;
}

/** Picking how we check it's your bar, and starting the claim. */
export function ClaimStart({ profile, declined }: { profile: Profile; declined: ProfileClaim | null }) {
  const ds = useDs();
  const { user } = useAuth();
  const adminVenues = useActiveVenue().venues.filter((v) => v.roleLevel >= 40);
  const details = methodDetails(profile, user?.email_confirmed_at ? user.email : null);
  const [method, setMethod] = useState<BarClaimMethod>(() => BAR_CLAIM_METHODS.find((m) => details[m].available) ?? 'phone');
  const [venue, setVenue] = useState(NEW_VENUE);
  const [note, setNote] = useState('');
  const start = useStartBarClaim();
  const name = profile.display_name;

  const submit = () => start.mutate({ profileId: profile.id, method, barId: venue === NEW_VENUE ? null : venue, note });
  const pick = (m: BarClaimMethod) => {
    setMethod(m);
    start.reset();
  };

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <UserAvatar uri={profile.avatar_url} name={name} size={64} />
        <Caption tone="muted" style={styles.eyebrow}>
          Claim this page
        </Caption>
        <Title>{`Claim ${name}`}</Title>
        <Body tone="muted">Show us you work here and the page is yours: you run its drinks, its team, and who sees its specs.</Body>
      </View>

      {declined ? (
        <Surface style={[styles.declined, { borderColor: ds.c.lineStrong }]}>
          <Headline role="heading">Your last claim wasn’t approved</Headline>
          <Body tone="muted">{declined.decline_reason ?? 'A moderator couldn’t confirm it.'}</Body>
          <Caption tone="muted">Try again below, or pick another way.</Caption>
        </Surface>
      ) : null}

      <View style={styles.group}>
        <Caption tone="muted" style={styles.eyebrow}>
          How we check
        </Caption>
        <View role="radiogroup" accessibilityLabel="How we check it’s your bar" style={styles.group}>
          {BAR_CLAIM_METHODS.map((m) => (
            <Choice
              key={m}
              label={details[m].instant ? `${METHOD_COPY[m].label} (instant)` : METHOD_COPY[m].label}
              detail={details[m].detail}
              selected={method === m}
              disabled={!details[m].available || start.isPending}
              onPress={() => pick(m)}
            />
          ))}
        </View>
      </View>

      {adminVenues.length ? (
        <View style={styles.group}>
          <Caption tone="muted" style={styles.eyebrow}>
            Which venue runs it
          </Caption>
          <Segmented
            accessibilityLabel="Which venue runs it"
            options={[{ value: NEW_VENUE, label: 'A new venue' }, ...adminVenues.map((v) => ({ value: v.id, label: v.name }))]}
            value={venue}
            onChange={setVenue}
          />
          <Caption tone="muted">
            {venue === NEW_VENUE ? `We’ll make a venue called ${name} with you as its Admin.` : 'The page joins this venue, with its drinks and team.'}
          </Caption>
        </View>
      ) : null}

      <Field
        label={method === 'phone' ? 'Who should we ask for, and when?' : 'Your name and what you do there'}
        hint="Only moderators see this."
        value={note}
        onChangeText={setNote}
        maxLength={1000}
      />

      {start.error ? (
        <Caption tone="accent" role="alert">
          {claimProblem(start.error)}
        </Caption>
      ) : null}
      <Button
        label={start.isPending ? 'Sending…' : method === 'email' ? `Claim ${name}` : 'Get my code'}
        size="lg"
        disabled={start.isPending || !details[method].available}
        onPress={submit}
      />
      <Caption tone="muted">Your page starts Locked: guests see the bar, its awards, team and drink names. You choose when to share more.</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: space.xl },
  header: { gap: space.sm },
  eyebrow: { letterSpacing: 1.2, textTransform: 'uppercase' },
  group: { gap: space.sm },
  declined: { gap: space.xs, borderWidth: 1 },
});
