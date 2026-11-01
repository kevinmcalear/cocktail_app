import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, DsText, Headline, TextLink, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { radius, space, STATUS } from '@/constants/tokens';
import { useAnswerJoinRequest, useClaimsToConfirm, useConfirmPersonClaim, useJoinRequests } from '@/hooks/useJoinRequests';
import { useStaffLink } from '@/hooks/useStaffLink';
import { roleLabel } from '@/lib/roles';
import { askedAgo } from '@/lib/team';

/**
 * People asking to join the team (find-yourself step 6), on top of Team for
 * whoever manages it, as the board's prompt (Kept-team): "Sam Whitlock asked
 * to join", when, then Add as the staff link's join role, or Not now. Not
 * now says no (the request stays declined). Nothing when nobody is asking.
 */
const BARTENDER = 30;

export function JoinRequests({ barId }: { barId: string }) {
  const ds = useDs();
  const router = useRouter();
  const requests = useJoinRequests(barId, true).data ?? [];
  const answer = useAnswerJoinRequest(barId);
  const link = useStaffLink(barId);
  // The button names the role the database adds them at (the staff link's), once it's read.
  const joinRole = link.data?.role ?? BARTENDER;
  const [now] = useState(Date.now);
  if (!requests.length) return null;
  const busy = answer.isPending || link.isLoading;
  const failed = answer.error;

  return (
    <View role="list" aria-label="Asking to join" style={styles.section}>
      {requests.map((r) => {
        const ago = askedAgo(r.created_at, now);
        return (
          <View key={r.id} role="listitem" style={[styles.prompt, { backgroundColor: ds.c.raised }]}>
            <View style={styles.promptHead}>
              <IconSymbol name="person.badge.plus" size={20} color={ds.c.ink} />
              <View style={styles.flex}>
                <DsText variant="headline">{`${r.name} asked to join`}</DsText>
                <Caption tone="muted">{`From your bar’s page${ago ? `, ${ago}` : ''}.`}</Caption>
                {r.profile_handle ? <TextLink label={`See @${r.profile_handle}`} onPress={() => router.push(`/p/${r.profile_handle}` as Href)} /> : null}
              </View>
            </View>
            <View style={styles.actions}>
              <Button label={`Add as ${roleLabel(joinRole)}`} size="sm" disabled={busy} accessibilityLabel={`Add ${r.name} as ${roleLabel(joinRole)}`} onPress={() => answer.mutate({ id: r.id, accept: true })} />
              <Button label="Not now" size="sm" variant="ghost" disabled={busy} accessibilityLabel={`Not now for ${r.name}`} onPress={() => answer.mutate({ id: r.id, accept: false })} />
            </View>
          </View>
        );
      })}
      {failed ? (
        <Caption color={STATUS.danger} role="alert">
          {failed.message}
        </Caption>
      ) : null}
    </View>
  );
}

/**
 * People claiming a page that lists them at this bar, who asked the bar to
 * confirm it's them (find-yourself step 4, "<bar> confirms you"). For the
 * venue's Admins: Confirm hands them the page, and a current job here puts
 * them on the team (20261128700000). Anything else is a
 * moderator's to check. Nothing when none wait.
 */
export function ClaimsToConfirm({ barId, barName, admin }: { barId: string; barName: string; admin: boolean }) {
  const ds = useDs();
  const router = useRouter();
  const claims = useClaimsToConfirm(barId, admin).data ?? [];
  const confirm = useConfirmPersonClaim(barId);
  if (!admin || !claims.length) return null;

  return (
    <View style={styles.section}>
      <Headline role="heading">Confirm who they are</Headline>
      <Caption tone="muted">{`They say they’re someone ${barName}’s page lists. Confirm only people you know worked here: their page and its drinks become theirs, and if they still work here they join the team as a Bartender. Not sure? Leave it and a person checks.`}</Caption>
      <View role="list" aria-label="Confirm who they are">
        {claims.map((c) => (
          <View key={c.id} role="listitem" style={[styles.row, { borderBottomColor: ds.c.line }]}>
            <UserAvatar uri={null} name={c.claimant_name} size={40} />
            <View style={styles.flex}>
              <DsText variant="headline" numberOfLines={2}>{`${c.claimant_name} says they’re ${c.page_name}`}</DsText>
              <TextLink label={`See ${c.page_name}’s page`} onPress={() => router.push(`/p/${c.page_handle}` as Href)} />
              {c.claimant_handle ? <TextLink label={`Their own page, @${c.claimant_handle}`} tone="ink" onPress={() => router.push(`/p/${c.claimant_handle}` as Href)} /> : null}
              <View style={styles.actions}>
                <Button label="Confirm" disabled={confirm.isPending} accessibilityLabel={`Confirm ${c.claimant_name} is ${c.page_name}`} onPress={() => confirm.mutate(c.id)} />
              </View>
            </View>
          </View>
        ))}
      </View>
      {confirm.error ? (
        <Caption tone="accent" role="alert">
          {confirm.error.message}
        </Caption>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  flex: { flex: 1, minWidth: 0, gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  prompt: { padding: space.lg, gap: space.sm, borderRadius: radius.card, borderCurve: 'continuous' },
  promptHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
});
