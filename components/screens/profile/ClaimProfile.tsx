import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field, Segmented, Tag } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useClaimProfile, useMyClaims, type Profile } from '@/hooks/useProfiles';

/** Postgres errors from the claim insert, in words. */
function claimError(error: unknown, kind: Profile['kind']): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === '23505') return 'You already have a claim waiting on this profile.';
  if (code === '42501') {
    return kind === 'bar'
      ? "You can't claim this bar for that venue. Ask someone who can publish for it."
      : "You can't claim this profile. It may have been claimed already.";
  }
  return "Couldn't send your claim. Check your connection and try again.";
}

/**
 * "Claim this profile": the person (or a bar's team) asks to take over an
 * unclaimed profile, with a note a moderator can check. Approval is on
 * /p/review-claims.
 */
export function ClaimProfile({ profile }: { profile: Profile }) {
  const { user } = useAuth();
  const { venues } = useActiveVenue();
  const { data: claims } = useMyClaims(profile.id);
  const claim = useClaimProfile();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [venueId, setVenueId] = useState<string | null>(null);

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

  const isBar = profile.kind === 'bar';
  const barId = isBar ? (venueId ?? venues[0]?.id ?? null) : null;
  const rejected = latest?.status === 'rejected';

  if (!open) {
    return (
      <View style={styles.box}>
        {rejected ? <Caption tone="muted">Your last claim wasn’t approved. You can try again with more detail.</Caption> : null}
        <Button
          label="Claim this profile"
          variant="secondary"
          icon="checkmark"
          accessibilityHint={isBar ? 'Ask to manage this bar profile for your venue' : 'Ask to take over this profile as yours'}
          onPress={() => setOpen(true)}
          style={styles.hug}
        />
      </View>
    );
  }

  if (isBar && !venues.length) {
    return <Body tone="muted">Only a bar’s own team can claim its profile. Join the bar in the app first.</Body>;
  }

  return (
    <View style={styles.box}>
      <Body>{isBar ? `Claim ${profile.display_name} for your venue.` : `Is this you? Claim ${profile.display_name} as your profile.`}</Body>
      {isBar && venues.length > 1 ? (
        <Segmented
          accessibilityLabel="Claim for which venue"
          options={venues.map((v) => ({ value: v.id, label: v.name }))}
          value={barId ?? ''}
          onChange={(id) => {
            setVenueId(id);
            claim.reset();
          }}
        />
      ) : null}
      <Field
        label={isBar ? "How can a moderator check it's your bar?" : "How can a moderator check it's you?"}
        hint="A link to your Instagram, website or a press piece helps."
        value={message}
        onChangeText={setMessage}
        multiline
        numberOfLines={3}
        maxLength={1000}
      />
      {claim.error ? (
        <Caption tone="accent" role="alert">
          {claimError(claim.error, profile.kind)}
        </Caption>
      ) : null}
      <View style={styles.actions}>
        <Button
          label={claim.isPending ? 'Sending…' : 'Send claim'}
          disabled={claim.isPending || (isBar && !barId)}
          onPress={() => claim.mutate({ profile_id: profile.id, message, bar_id: barId })}
        />
        <Button label="Cancel" variant="ghost" onPress={() => setOpen(false)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.sm },
  hug: { alignSelf: 'flex-start' },
  actions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
});
