import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, useDs } from '@/components/ds';
import { RowDivider, SettingsRow, SettingsSection, SwitchRow } from '@/components/screens/settings/SettingsParts';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { displayFaces, space, STATUS } from '@/constants/tokens';
import { useRemoveMember, type BarMember } from '@/hooks/useBarDetail';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useMemberPosition, useMemberStats, useSetPositionShown } from '@/hooks/useTeam';
import { useRoleMatrix, useSetMemberRoleChoice, type MemberRoleChoice } from '@/hooks/useVenueRoles';
import { plainDbMessage } from '@/lib/dbError';
import { confirmAsync } from '@/lib/dialogs';
import { reachCeiling, withinReach } from '@/lib/roleMatrix';
import { roleLabel } from '@/lib/roles';
import { memberRoleName, nextShiftLabel, personName, sinceLabel, TEAM_MANAGE } from '@/lib/team';

import { MemberRoleSheet } from './MemberRoleSheet';

/**
 * A teammate's page (Kept-team, A person; beside the list on the web,
 * Kept-team-desk): their photo and name, role and since when, what they've
 * made here, their next shift, their role to change, and Remove. Their
 * name stays on the drinks they made.
 */
export function MemberPage({ barId, barName, member, role, onRemoved }: {
  barId: string;
  barName: string;
  member: BarMember;
  /** The manager's own effective role. */
  role: number;
  onRemoved: () => void;
}) {
  const ds = useDs();
  const admin = role >= TEAM_MANAGE;
  const matrix = useRoleMatrix(barId).data ?? [];
  const myCaps = useCapabilities(barId).data;
  const change = useSetMemberRoleChoice(barId);
  const remove = useRemoveMember(barId);
  const stats = useMemberStats(barId, member.user_id);
  const position = useMemberPosition(barId, member.user_id).data;
  const show = useSetPositionShown(barId, member.user_id);
  const canPublish = admin || !!myCaps?.includes('publish');
  const [picking, setPicking] = useState(false);
  const [now] = useState(Date.now);
  // Someone with staff who isn't an Admin hands out only what they can do themselves.
  const mine = admin ? null : (myCaps ?? []);
  const venueRoles = matrix.filter((r) => r.role_id && withinReach(r.capabilities, mine));
  const ceiling = reachCeiling(matrix, mine, role);
  const name = personName(member);
  const first = name.split(/\s+/)[0];
  const since = sinceLabel(member);
  const busy = change.isPending || remove.isPending;
  const error = change.error ?? remove.error ?? show.error;

  const setRole = async (choice: MemberRoleChoice, label: string, level: number) => {
    const ok =
      level < TEAM_MANAGE ||
      member.role_level >= TEAM_MANAGE ||
      (await confirmAsync({
        title: label === roleLabel(TEAM_MANAGE) ? `Make ${name} an Admin?` : `Make ${name} ${label}?`,
        message: 'Admins can change the venue and everyone’s role, including yours.',
        confirmText: 'Make Admin',
      }));
    if (ok) change.mutate({ userId: member.user_id, choice }, { onSettled: () => setPicking(false) });
  };

  const removeMember = async () => {
    const ok = await confirmAsync({ title: `Remove ${name}?`, message: `They lose access to ${barName}. Their name stays on the drinks they made.`, confirmText: 'Remove', destructive: true });
    // mutateAsync: the list refetch unmounts this page first, and mutate's own callbacks would never fire.
    if (ok) remove.mutateAsync(member.user_id).then(onRemoved, () => undefined);
  };

  const shift = nextShiftLabel(stats.nextShift, now);
  const cells = [
    { n: String(stats.credited), t: stats.credited === 1 ? 'drink credited' : 'drinks credited' },
    ...(stats.onList ? [{ n: String(stats.onList.count), t: `on ${stats.onList.name}` }] : []),
    { n: shift ?? 'None', t: 'next shift' },
  ];

  return (
    <View style={styles.page}>
      <View style={styles.who}>
        <UserAvatar uri={member.avatar_url} name={name} email={member.email} size={88} />
        <DsText variant="title" aria-level={1} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
          {name}
        </DsText>
        <Caption tone="muted">{[memberRoleName(member), since].filter(Boolean).join(' · ')}</Caption>
      </View>
      <View role="list" aria-label={`${first}’s numbers`} style={styles.stats}>
        {stats.failed ? <Caption tone="muted" role="alert" style={styles.statNote}>{`Couldn’t load ${first}’s numbers.`}</Caption> : null}
        {stats.loading && !stats.failed ? <Caption tone="muted" style={styles.statNote}>Loading…</Caption> : null}
        {stats.failed || stats.loading ? null : cells.map((c, i) => (
          <View key={c.t} role="listitem" style={[styles.stat, i > 0 ? { borderLeftColor: ds.c.line, borderLeftWidth: StyleSheet.hairlineWidth } : null]}>
            <DsText variant="title" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>{c.n}</DsText>
            <Caption tone="muted" numberOfLines={2} style={styles.statLabel}>{c.t}</Caption>
          </View>
        ))}
      </View>
      <SettingsSection>
        <SettingsRow label="Role" value={memberRoleName(member)} disabled={busy} onPress={() => setPicking(true)} />
        {/* Only when they have a job on the bar's page to show: with none, there's nothing to switch. */}
        {position ? <RowDivider /> : null}
        {position ? (
          <SwitchRow
            label={`Shows on ${barName}’s page`}
            detail="Under Who makes the drinks"
            value={!position.is_hidden}
            disabled={!canPublish || show.isPending}
            onValueChange={(shown) => show.mutate({ id: position.id, shown })}
          />
        ) : null}
      </SettingsSection>
      <View style={styles.remove}>
        <SettingsSection>
          <SettingsRow label={`Remove ${first} from ${barName}`} tone="danger" role="button" busy={remove.isPending} trailing={<View />} onPress={() => void removeMember()} />
        </SettingsSection>
        <Caption tone="muted" style={styles.aside}>{`${first}’s name stays on the drinks they made.`}</Caption>
      </View>
      {error ? (
        <Body color={STATUS.danger} role="alert">
          {plainDbMessage(error) ?? 'Couldn’t save that. Check your connection and try again.'}
        </Body>
      ) : null}
      <MemberRoleSheet member={member} barName={barName} visible={picking} ceiling={ceiling} venueRoles={venueRoles} busy={busy} onClose={() => setPicking(false)} onRole={(c, l, lv) => void setRole(c, l, lv)} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: space.lg },
  who: { alignItems: 'center', gap: space.sm, paddingTop: space.md },
  stats: { flexDirection: 'row', alignItems: 'center', minHeight: 72, paddingVertical: space.sm },
  statNote: { flex: 1, textAlign: 'center' },
  stat: { flex: 1, minWidth: 0, alignItems: 'center', gap: 2, paddingHorizontal: space.xs },
  statLabel: { textAlign: 'center' },
  remove: { gap: space.sm, marginTop: space.md },
  aside: { paddingHorizontal: space.xs },
});
