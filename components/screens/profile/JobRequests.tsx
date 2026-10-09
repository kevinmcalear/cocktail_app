import { StyleSheet, View } from 'react-native';

import { Button, Caption, DsText, Headline, useDs } from '@/components/ds';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { space } from '@/constants/tokens';
import { useAnswerPosition, usePositionRequests } from '@/hooks/usePositionRequests';
import { useProfilePositions } from '@/hooks/useProfiles';

/**
 * Jobs people listed at a bar, waiting for the bar's yes. On the Team screen
 * for a venue's Admins (venueId), and in Reports for moderators, who answer
 * for bars with no venue on Cocktail (venueId null). Nothing when none wait.
 */
export function JobRequests({ venueId, title }: { venueId: string | null; title: string }) {
  const ds = useDs();
  const requests = (usePositionRequests().data ?? []).filter((r) => r.venue_id === venueId);
  const answer = useAnswerPosition();
  if (!requests.length) return null;
  const busy = answer.isPending;

  return (
    <View style={styles.section}>
      <Headline role="heading">{title}</Headline>
      <Caption tone="muted">They show on the person’s profile and the bar’s once you accept. Decline removes the job.</Caption>
      <View role="list" aria-label={title}>
        {requests.map((r) => (
          <View key={r.id} role="listitem" style={[styles.row, { borderBottomColor: ds.c.line }]}>
            <UserAvatar uri={r.person_avatar_url} name={r.person_name} size={40} />
            <View style={styles.flex}>
              <DsText variant="headline" numberOfLines={1}>
                {r.person_name}
              </DsText>
              <Caption tone="muted">{`${r.is_current ? r.title : `Formerly ${r.title}`}${venueId ? '' : ` at ${r.bar_name}`}`}</Caption>
              <View style={styles.actions}>
                <Button label="Accept" disabled={busy} onPress={() => answer.mutate({ id: r.id, accept: true })} />
                <Button label="Decline" variant="ghost" disabled={busy} onPress={() => answer.mutate({ id: r.id, accept: false })} />
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
 * The signed-in person's own jobs that aren't showing yet: ones a bar listed
 * them in, for them to accept, and ones they added, waiting on the bar. On
 * You and Settings › Public profile. Nothing when none wait.
 */
export function MyJobRequests({ personId }: { personId: string }) {
  const ds = useDs();
  const positions = useProfilePositions({ id: personId, kind: 'person' }).data ?? [];
  const answer = useAnswerPosition();
  const asked = positions.filter((p) => !p.person_accepted);
  const waiting = positions.filter((p) => p.person_accepted && !p.bar_accepted);
  if (!asked.length && !waiting.length) return null;

  return (
    <View style={styles.section}>
      <Headline role="heading">Jobs waiting</Headline>
      <View role="list" aria-label="Jobs waiting">
        {asked.map((p) => (
          <View key={p.id} role="listitem" style={[styles.row, { borderBottomColor: ds.c.line }]}>
            <UserAvatar uri={p.bar.avatar_url} name={p.bar.display_name} size={40} />
            <View style={styles.flex}>
              <DsText variant="headline" numberOfLines={2}>{`${p.title}, ${p.bar.display_name}`}</DsText>
              <Caption tone="muted">{`${p.bar.display_name} listed you. It shows on your profile once you accept.`}</Caption>
              <View style={styles.actions}>
                <Button label="Accept" disabled={answer.isPending} onPress={() => answer.mutate({ id: p.id, accept: true })} />
                <Button label="Decline" variant="ghost" disabled={answer.isPending} onPress={() => answer.mutate({ id: p.id, accept: false })} />
              </View>
            </View>
          </View>
        ))}
        {waiting.map((p) => (
          <View key={p.id} role="listitem" style={[styles.row, { borderBottomColor: ds.c.line }]}>
            <UserAvatar uri={p.bar.avatar_url} name={p.bar.display_name} size={40} />
            <View style={styles.flex}>
              <DsText variant="headline" numberOfLines={2}>{`${p.title}, ${p.bar.display_name}`}</DsText>
              <Caption tone="muted">On your profile, marked not confirmed, until the bar says yes.</Caption>
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
 * A line for a job that isn't confirmed yet, or null once it is. Everyone sees
 * a job the person added before the bar confirms it; only the two sides see
 * one the bar listed before the person accepts.
 */
export function pendingNote(p: { person_accepted: boolean; bar_accepted: boolean }): string | null {
  if (!p.person_accepted) return 'Pending: waiting for the person to accept';
  if (!p.bar_accepted) return 'Not confirmed by the bar';
  return null;
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  flex: { flex: 1, minWidth: 0, gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
});
