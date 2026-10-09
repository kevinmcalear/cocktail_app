import type { ReactNode } from 'react';
import { Platform, StyleSheet, Switch, View } from 'react-native';

import { Body, Caption, DsText, useDs } from '@/components/ds';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { backbar, radius, space } from '@/constants/tokens';
import { useProfilePositions, useShowPosition, type Position } from '@/hooks/useProfiles';

const NOTE = 'Drinks you created at past bars keep your credit either way. This only changes the jobs list.';

/** On a claim: the claimant can't see the hidden past jobs until it's theirs. */
export const CLAIM_PAST_JOBS =
  'Some past jobs here are public record and already show. Once this profile is yours, you choose which past jobs to show. Drinks you created keep your credit either way.';

/**
 * Your own jobs, with a switch on each past one: where you work now always
 * shows; a past job shows only once you switch it on. Onboarding's past-jobs
 * step and Settings › Public profile.
 */
export function PastJobs({ personId }: { personId: string }) {
  const ds = useDs();
  // Jobs a bar listed them in wait in MyJobRequests until they accept.
  const positions = (useProfilePositions({ id: personId, kind: 'person' }).data ?? []).filter((p) => p.person_accepted);
  const show = useShowPosition();
  const now = positions.filter((p) => p.is_current);
  const before = positions.filter((p) => !p.is_current);
  // The switch moves straight away; a failed save puts it back.
  const shown = (p: Position) => (show.isPending && show.variables?.id === p.id ? show.variables.shown : p.is_shown);

  const row = (p: Position, end: ReactNode) => (
    <View key={p.id} style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <UserAvatar uri={p.bar.avatar_url} name={p.bar.display_name} size={40} />
      <View style={styles.flex}>
        <DsText variant="headline" numberOfLines={2}>{`${p.title}, ${p.bar.display_name}`}</DsText>
        {!p.bar_accepted ? (
          <Caption tone="muted">Not confirmed by the bar yet. It shows marked that way.</Caption>
        ) : p.is_current ? (
          <Caption tone="muted">Always shown</Caption>
        ) : null}
      </View>
      {end}
    </View>
  );

  return (
    <View style={styles.box}>
      {now.length ? (
        <View role="list">
          <Caption tone="muted" style={styles.cap}>Now</Caption>
          {now.map((p) => row(p, null))}
        </View>
      ) : null}
      {before.length ? (
        <View role="list">
          <Caption tone="muted" style={styles.cap}>Before</Caption>
          {before.map((p) =>
            row(
              p,
              <Switch
                value={shown(p)}
                onValueChange={(on) => show.mutate({ id: p.id, shown: on })}
                aria-label={`Show ${p.bar.display_name} on my profile`}
                trackColor={{ false: ds.c.lineStrong, true: ds.accentFill.fill }}
                // A white thumb on every platform. react-native-web colours the
                // on thumb from its own activeThumbColor (teal by default).
                thumbColor={backbar.light.surface}
                {...(Platform.OS === 'web' ? { activeThumbColor: backbar.light.surface } : null)}
              />
            )
          )}
        </View>
      ) : null}
      {show.error ? (
        <Caption tone="accent" role="alert">
          {show.error.message}
        </Caption>
      ) : null}
      <View style={[styles.note, { backgroundColor: ds.c.raised }]}>
        <Body tone="muted">{NOTE}</Body>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.lg },
  cap: { letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: space.xs },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  note: { borderRadius: radius.card, paddingHorizontal: space.lg, paddingVertical: space.md },
});
