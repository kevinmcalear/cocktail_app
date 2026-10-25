import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, DsText, Headline, TextLink, useDs } from '@/components/ds';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { space } from '@/constants/tokens';
import { useAnswerJoinRequest, useJoinRequests } from '@/hooks/useJoinRequests';

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

const styles = StyleSheet.create({
  section: { gap: space.sm },
  flex: { flex: 1, minWidth: 0, gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
});
