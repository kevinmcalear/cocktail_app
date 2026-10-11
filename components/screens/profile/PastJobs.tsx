import { Platform, StyleSheet, Switch, View } from 'react-native';

import { Caption, DsText, useDs } from '@/components/ds';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { backbar, space } from '@/constants/tokens';
import { useProfilePositions, useShowPosition, type Position } from '@/hooks/useProfiles';
import { jobYears } from '@/lib/onboarding';

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
  // Where they work now first, then the past ones.
  const rows = [...positions.filter((p) => p.is_current), ...positions.filter((p) => !p.is_current)];
  // The switch moves straight away; a failed save puts it back.
  const shown = (p: Position) => (show.isPending && show.variables?.id === p.id ? show.variables.shown : p.is_shown);

  return (
    <View style={styles.box}>
      {rows.length ? (
        <View role="list" accessibilityLabel="Your jobs">
          {rows.map((p) => {
            // ponytail: dates arrive with the b09 columns; until then jobYears has none to show.
            const years = jobYears(p as Position & { start_year?: number | null; end_year?: number | null });
            return (
              <View key={p.id} role="listitem" style={[styles.row, { borderBottomColor: ds.c.line }]}>
                <UserAvatar uri={p.bar.avatar_url} name={p.bar.display_name} size={40} />
                <View style={styles.flex}>
                  <DsText variant="headline" numberOfLines={2}>
                    {p.title}
                  </DsText>
                  <Caption tone="muted" numberOfLines={1}>
                    {years ? `${p.bar.display_name} · ${years}` : p.bar.display_name}
                  </Caption>
                  <Caption tone="muted" numberOfLines={1}>
                    {p.bar_accepted ? `Confirmed by ${p.bar.display_name}` : 'Not confirmed by the bar yet'}
                  </Caption>
                </View>
                {p.is_current ? (
                  <Caption tone="muted">Now · always shown</Caption>
                ) : (
                  <View style={styles.end}>
                    <Switch
                      value={shown(p)}
                      onValueChange={(on) => show.mutate({ id: p.id, shown: on })}
                      aria-label={`Show ${p.title} at ${p.bar.display_name} on your profile`}
                      trackColor={{ false: ds.c.lineStrong, true: ds.accentFill.fill }}
                      // A white thumb on every platform. react-native-web colours the
                      // on thumb from its own activeThumbColor (teal by default).
                      thumbColor={backbar.light.surface}
                      {...(Platform.OS === 'web' ? { activeThumbColor: backbar.light.surface } : null)}
                    />
                    <Caption tone="muted">{shown(p) ? 'Shown' : 'Hidden'}</Caption>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ) : null}
      {show.error ? (
        <Caption tone="accent" role="alert">
          {show.error.message}
        </Caption>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.lg },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  end: { alignItems: 'center', gap: space.xs },
});
