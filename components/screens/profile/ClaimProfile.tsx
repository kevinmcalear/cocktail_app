import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field, Tag } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useClaimProfile, useMyClaims, type Profile } from '@/hooks/useProfiles';

import { CLAIM_PAST_JOBS } from './PastJobs';

/** Postgres errors from the claim insert, in words. */
function claimError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === '23505') return 'You already have a claim waiting on this profile.';
  if (code === '42501') return "You can't claim this profile. It may have been claimed already.";
  if (code === 'P0001') return (error as { message: string }).message;
  return "Couldn't send your claim. Check your connection and try again.";
}

/**
 * "Claim this profile". A bar's page goes to its own claim screen
 * (/p/<id>/claim), where the bar proves it's theirs. A person asks to take
 * over an unclaimed profile with a note a moderator checks on
 * /p/review-claims.
 */
export function ClaimProfile({ profile, label = 'Claim this profile' }: { profile: Profile; label?: string }) {
  return profile.kind === 'bar' ? <ClaimBar profile={profile} label={label} /> : <ClaimPerson profile={profile} label={label} />;
}

/** Where a bar's claim stands, and the way into the claim screen. */
function ClaimBar({ profile, label }: { profile: Profile; label: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { data: claims } = useMyClaims(profile.id);
  const latest = claims?.[0];
  const open = () => router.push((user ? `/p/${profile.id}/claim` : '/auth/login') as Href);
  if (latest?.status === 'pending') {
    return (
      <View style={styles.centered} role="status">
        <Tag label="Claim sent" />
        <Caption tone="muted" align="center">
          {latest.code ? 'Your code is on the claim screen.' : 'A moderator is checking it.'}
        </Caption>
        <Button label="See your claim" variant="secondary" onPress={open} />
      </View>
    );
  }
  return (
    <View style={styles.centered}>
      {latest?.status === 'rejected' ? (
        <Caption tone="muted" align="center">
          Your last claim wasn’t approved. You can try another way.
        </Caption>
      ) : null}
      <Button label={label} variant="secondary" icon="checkmark" accessibilityHint="Prove you work here and take over this page" onPress={open} />
    </View>
  );
}

function ClaimPerson({ profile, label }: { profile: Profile; label: string }) {
  const { user } = useAuth();
  const { data: claims } = useMyClaims(profile.id);
  const claim = useClaimProfile();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');

  if (!user) return null;
  const latest = claims?.[0];
  if (latest?.status === 'pending') {
    return (
      <View style={styles.box} role="status">
        <Tag label="Claim sent" />
        <Caption tone="muted">A moderator will check it and hand the profile over once it’s approved.</Caption>
      </View>
    );
  }

  if (!open) {
    return (
      <View style={styles.box}>
        {latest?.status === 'rejected' ? (
          <Caption tone="muted">{latest.decline_reason ?? 'Your last claim wasn’t approved. You can try again with more detail.'}</Caption>
        ) : null}
        <Button
          label={label}
          variant="secondary"
          icon="checkmark"
          accessibilityHint="Ask to take over this profile as yours"
          onPress={() => setOpen(true)}
          style={styles.hug}
        />
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <Body>{`Is this you? Claim ${profile.display_name} as your profile.`}</Body>
      <Field
        label="How can a moderator check it's you?"
        hint="A link to your Instagram, website or a press piece helps."
        value={message}
        onChangeText={setMessage}
        multiline
        numberOfLines={3}
        maxLength={1000}
      />
      {isBar ? null : <Caption tone="muted">{CLAIM_PAST_JOBS}</Caption>}
      {claim.error ? (
        <Caption tone="accent" role="alert">
          {claimError(claim.error)}
        </Caption>
      ) : null}
      <View style={styles.actions}>
        <Button
          label={claim.isPending ? 'Sending…' : 'Send claim'}
          disabled={claim.isPending}
          onPress={() => claim.mutate({ profile_id: profile.id, message, bar_id: null })}
        />
        <Button label="Cancel" variant="ghost" onPress={() => setOpen(false)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.sm },
  centered: { gap: space.sm, alignItems: 'center' },
  hug: { alignSelf: 'flex-start' },
  actions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
});
