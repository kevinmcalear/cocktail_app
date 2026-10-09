import { useRouter, type Href } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, Surface, Tag, Title, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useWithdrawClaim } from '@/hooks/useBarClaims';
import type { Profile, ProfileClaim } from '@/hooks/useProfiles';
import { REVIEW_REASON, claimPlace, claimProblem, pageInstagram, spacedCode } from '@/lib/claimVerification';
import { instagramUrl } from '@/lib/profiles';

/** The claim's six digits, big enough to read out across a bar. */
function CodeCard({ code }: { code: string }) {
  const ds = useDs();
  return (
    <Surface style={[styles.code, { borderColor: ds.c.lineStrong }]}>
      <Caption tone="muted" style={styles.eyebrow}>
        Your code
      </Caption>
      <DsText variant="display" selectable style={styles.digits} accessibilityLabel={`Your code: ${code.split('').join(' ')}`}>
        {spacedCode(code)}
      </DsText>
    </Surface>
  );
}

/** What to do while a claim waits: the code and where it goes, or why a moderator is checking an email. */
export function ClaimPending({ claim, profile }: { claim: ProfileClaim; profile: Profile }) {
  const withdraw = useWithdrawClaim();
  const handle = claim.evidence?.instagram ?? pageInstagram(profile);
  const name = profile.display_name;
  const reason = claim.evidence?.review_reason;

  const [title, text] =
    claim.method === 'instagram'
      ? ['Put this code in your bio', `Add it anywhere in @${handle}’s Instagram bio and leave it there until we’ve checked, usually within a day. Then take it out.`]
      : claim.method === 'phone'
        ? ['Keep this code by the phone', `We’ll ring ${name} on a number we look up ourselves. Whoever answers reads us this code, so leave it with the team.`]
        : [
            'A moderator is checking',
            `You signed in at ${claim.evidence?.email_domain ?? `the ${claimPlace(profile.kind)}’s domain`}. ${reason ? `Because ${REVIEW_REASON[reason]}, someone` : 'Someone'} checks it before the page is yours.`,
          ];

  return (
    <View style={styles.page} role="status">
      <Tag label="Waiting for a check" tone="warning" style={styles.hug} />
      <Title>{title}</Title>
      <Body tone="muted">{text}</Body>
      {claim.code ? <CodeCard code={claim.code} /> : null}
      {claim.method === 'phone' && claim.message ? <Caption tone="muted">{`We’ll ask for: ${claim.message}`}</Caption> : null}
      {claim.method === 'instagram' && handle ? (
        <Button label={`Open @${handle}`} variant="secondary" icon="link" onPress={() => Linking.openURL(instagramUrl(handle))} style={styles.hug} />
      ) : null}
      {withdraw.error ? (
        <Caption tone="accent" role="alert">
          {claimProblem(withdraw.error)}
        </Caption>
      ) : null}
      <View style={styles.footer}>
        <Caption tone="muted">{`Sent ${new Date(claim.created_at).toLocaleDateString()}`}</Caption>
        <Button
          label={withdraw.isPending ? 'Withdrawing…' : 'Withdraw claim'}
          variant="ghost"
          disabled={withdraw.isPending}
          accessibilityHint="Cancels this claim so you can start again"
          onPress={() => withdraw.mutate(claim.id)}
        />
      </View>
    </View>
  );
}

/** The page is theirs: where it stands (Locked) and where to choose who sees it. */
export function ClaimApproved({ profile }: { profile: Profile }) {
  const ds = useDs();
  const router = useRouter();
  return (
    <View style={styles.page} role="status">
      <View style={[styles.ring, { borderColor: ds.accentText }]} aria-hidden>
        <IconSymbol name="checkmark" size={22} color={ds.accentText} />
      </View>
      <Title>{`${profile.display_name} is yours`}</Title>
      <Body tone="muted">
        {profile.kind === 'bar'
          ? 'You’re its Admin. The page starts Locked: guests see the bar, its awards, team and drink names, not descriptions or specs.'
          : 'You’re its Admin. Invite your team from the venue settings.'}
      </Body>
      {profile.bar_id && profile.kind === 'bar' ? (
        <Button label="Choose who sees your page" size="lg" onPress={() => router.push(`/settings/bar/${profile.bar_id}/publishing` as Href)} />
      ) : null}
      <Button label="Back to the page" variant="secondary" onPress={() => router.replace(`/p/${profile.handle}` as Href)} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: space.lg },
  hug: { alignSelf: 'flex-start' },
  eyebrow: { letterSpacing: 1.2, textTransform: 'uppercase' },
  code: { alignItems: 'center', gap: space.xs, borderWidth: 1, borderStyle: 'dashed', paddingVertical: space.xl },
  digits: { fontVariant: ['tabular-nums'], letterSpacing: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: space.sm },
  ring: { width: 56, height: 56, borderRadius: radius.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
