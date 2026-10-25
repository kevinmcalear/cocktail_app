import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, DsText, Headline, TextLink, useDs } from '@/components/ds';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { space } from '@/constants/tokens';
import { useAnswerJoinRequest, useClaimsToConfirm, useConfirmPersonClaim, useJoinRequests } from '@/hooks/useJoinRequests';

/**
 * People asking to join the team (find-yourself step 6), on the Team screen
 * for whoever manages it. Accept makes them a Bartender; you can change their
 * role after. Nothing when nobody is asking.
 */
export function JoinRequests({ barId, barName }: { barId: string; barName: string }) {
  const ds = useDs();
  const router = useRouter();
  const requests = useJoinRequests(barId, true).data ?? [];
  const answer = useAnswerJoinRequest(barId);
  if (!requests.length) return null;
  const busy = answer.isPending;

  return (
    <View style={styles.section}>
      <Headline role="heading">Asking to join</Headline>
      <Caption tone="muted">{`Accept makes them a Bartender at ${barName}. You can change their role once they’re in.`}</Caption>
      <View role="list" aria-label="Asking to join">
        {requests.map((r) => (
          <View key={r.id} role="listitem" style={[styles.row, { borderBottomColor: ds.c.line }]}>
            <UserAvatar uri={r.avatar_url} name={r.name} size={40} />
            <View style={styles.flex}>
              <DsText variant="headline" numberOfLines={1}>
                {r.name}
              </DsText>
              {r.profile_handle ? <TextLink label={`@${r.profile_handle}`} onPress={() => router.push(`/p/${r.profile_handle}` as Href)} /> : null}
              <View style={styles.actions}>
                <Button label="Accept" disabled={busy} accessibilityLabel={`Accept ${r.name}`} onPress={() => answer.mutate({ id: r.id, accept: true })} />
                <Button label="Decline" variant="ghost" disabled={busy} accessibilityLabel={`Decline ${r.name}`} onPress={() => answer.mutate({ id: r.id, accept: false })} />
              </View>
            </View>
          </View>
        ))}
      </View>
      {answer.error ? (
        <Caption tone="accent" role="alert">
          {answer.error.message}
        </Caption>
      ) : null}
    </View>
  );
}

/**
 * People claiming a page that lists them at this bar, who asked the bar to
 * confirm it's them (find-yourself step 4, "<bar> confirms you"). For the
 * venue's Admins: Confirm hands them the page. Anything else is a
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
      <Caption tone="muted">{`They say they’re someone ${barName}’s page lists. Confirm only people you know worked here: their page and its drinks become theirs. Not sure? Leave it and a person checks.`}</Caption>
      <View role="list" aria-label="Confirm who they are">
        {claims.map((c) => (
          <View key={c.id} role="listitem" style={[styles.row, { borderBottomColor: ds.c.line }]}>
            <UserAvatar uri={null} name={c.claimant_name} size={40} />
            <View style={styles.flex}>
              <DsText variant="headline" numberOfLines={2}>{`${c.claimant_name} says they’re ${c.page_name}`}</DsText>
              <TextLink label={`See ${c.page_name}’s page`} onPress={() => router.push(`/p/${c.page_handle}` as Href)} />
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
});
