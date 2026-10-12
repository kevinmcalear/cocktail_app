import { useState } from 'react';
import { Platform, StyleSheet, Switch, View } from 'react-native';

import { Button, Caption, DsText, Field, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { backbar, space } from '@/constants/tokens';
import { useEditPosition, useProfilePositions, useShowPosition, type Position } from '@/hooks/useProfiles';
import { jobYears } from '@/lib/profiles';

import { isShownPosition } from './Positions';

/** On a claim: the claimant can't see the hidden past jobs until it's theirs. */
export const CLAIM_PAST_JOBS =
  'Some past jobs here are public record and already show. Once this profile is yours, you choose which past jobs to show. Drinks you created keep your credit either way.';

/** "Confirmed by Little Rye", or that the bar hasn't yet. */
export const confirmedLine = (p: Pick<Position, 'bar_accepted' | 'bar'>) => (p.bar_accepted ? `Confirmed by ${p.bar.display_name}` : 'Not confirmed by the bar yet');

/**
 * Your jobs as one list (ppl-work), current first: the title, the bar and its
 * years, whether the bar confirmed it, and a Shown switch on every one, the
 * current job too (b55). A past job starts hidden. Tap a job to set its
 * years. Onboarding's past-jobs step and Settings › Public profile › Work.
 */
export function PastJobs({ personId }: { personId: string }) {
  const ds = useDs();
  // Jobs a bar listed them in wait in the asking cards until they accept.
  const positions = (useProfilePositions({ id: personId, kind: 'person' }).data ?? []).filter((p) => p.person_accepted);
  const show = useShowPosition();
  const [editing, setEditing] = useState<string | null>(null);
  // The switch moves straight away; a failed save puts it back.
  const shown = (p: Position) => (show.isPending && show.variables?.id === p.id ? show.variables.shown : isShownPosition(p));
  if (!positions.length) return null;

  return (
    <View style={styles.box}>
      <View role="list">
        {positions.map((p) => {
          const on = shown(p);
          const years = jobYears(p);
          return (
            <View key={p.id} role="listitem" style={[styles.item, { borderBottomColor: ds.c.line }]}>
              <View style={styles.row}>
                <PressableScale
                  role="button"
                  accessibilityLabel={`${p.title}, ${p.bar.display_name}${years ? `, ${years}` : ''}. ${confirmedLine(p)}. Set its years`}
                  onPress={() => setEditing(editing === p.id ? null : p.id)}
                  style={styles.main}
                >
                  <UserAvatar uri={p.bar.avatar_url} name={p.bar.display_name} size={40} />
                  <View style={styles.flex}>
                    <DsText variant="headline" numberOfLines={2}>
                      {p.title}
                    </DsText>
                    <Caption tone="muted">{[p.bar.display_name, years].filter(Boolean).join(' · ')}</Caption>
                    <View style={styles.mark}>
                      {p.bar_accepted ? <IconSymbol name="checkmark.seal.fill" size={14} color={ds.accentText} /> : null}
                      <Caption tone={p.bar_accepted ? 'ink' : 'muted'}>{confirmedLine(p)}</Caption>
                    </View>
                  </View>
                </PressableScale>
                <View style={styles.switch}>
                  <Switch
                    value={on}
                    onValueChange={(next) => show.mutate({ id: p.id, shown: next })}
                    aria-label={`Show ${p.title} at ${p.bar.display_name} on your profile`}
                    trackColor={{ false: ds.c.lineStrong, true: ds.accentFill.fill }}
                    // A white thumb on every platform. react-native-web colours the
                    // on thumb from its own activeThumbColor (teal by default).
                    thumbColor={backbar.light.surface}
                    {...(Platform.OS === 'web' ? { activeThumbColor: backbar.light.surface } : null)}
                  />
                  <Caption tone="muted">{on ? 'Shown' : 'Hidden'}</Caption>
                </View>
              </View>
              {editing === p.id ? <JobYears job={p} onDone={() => setEditing(null)} /> : null}
            </View>
          );
        })}
      </View>
      {show.error ? (
        <Caption tone="accent" role="alert">
          {show.error.message}
        </Caption>
      ) : null}
    </View>
  );
}

const year = (t: string) => (t.trim() ? Number(t) : null);

/** From and To years on one job: a current job runs to now. */
export function JobYears({ job, onDone }: { job: Position; onDone: () => void }) {
  const edit = useEditPosition();
  const [from, setFrom] = useState(job.start_year ? String(job.start_year) : '');
  const [to, setTo] = useState(job.end_year ? String(job.end_year) : '');
  const digits = (t: string) => t.replace(/\D/g, '').slice(0, 4);
  return (
    <View style={styles.years}>
      <View style={styles.pair}>
        <View style={styles.flex}>
          <Field label="From (year)" value={from} onChangeText={(t) => setFrom(digits(t))} keyboardType="number-pad" maxLength={4} />
        </View>
        <View style={styles.flex}>
          {job.is_current ? (
            <Field label="To" value="Now" editable={false} />
          ) : (
            <Field label="To (year)" value={to} onChangeText={(t) => setTo(digits(t))} keyboardType="number-pad" maxLength={4} />
          )}
        </View>
      </View>
      {edit.error ? (
        <Caption tone="accent" role="alert">
          {edit.error.message}
        </Caption>
      ) : null}
      <View style={styles.pair}>
        <Button
          label="Save years"
          disabled={edit.isPending}
          onPress={() =>
            edit.mutate(
              { id: job.id, start_year: year(from), start_month: null, end_year: job.is_current ? null : year(to), end_month: null },
              { onSuccess: onDone }
            )
          }
        />
        <Button label="Cancel" variant="ghost" onPress={onDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.md },
  item: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  main: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.sm },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  mark: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  switch: { alignItems: 'center', gap: 2 },
  years: { gap: space.sm, paddingLeft: 40 + space.md },
  pair: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
});
