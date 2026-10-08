import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ChipGroup, ErrorText, RowDivider, SectionTitle } from '@/components/bar/BarParts';
import { Body, Button, Caption, Field, Surface } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useSetMemberRole, type BarMember } from '@/hooks/useBarDetail';
import { useBarInvites, useRemoveInvite } from '@/hooks/useBarInvites';
import { plainDbMessage } from '@/lib/dbError';
import { confirmAsync } from '@/lib/dialogs';
import { ROLE_LEVELS, roleLabel } from '@/lib/roles';

const ADMIN = 40;

/** add_user_to_bar_by_email's errors in words. Its own messages (P0001) are written for people. */
function roleError(error: unknown): string | null {
  if (!error) return null;
  return plainDbMessage(error) ?? "Couldn't save that. Check your connection and try again.";
}

/**
 * The venue's team. Admins invite people by email (they join when they accept
 * on the staff link) and change roles; everyone else sees a read-only list. The RPC decides who may (real Admins only), so this
 * only reflects it: no controls on your own row, so you can't demote yourself
 * out of the venue, and no role above your own.
 */
export function TeamMembers({ barId, members, myRole }: { barId: string; members: BarMember[]; myRole: number }) {
  const myId = useAuth().user?.id;
  const change = useSetMemberRole(barId);
  const add = useSetMemberRole(barId);
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState(10);
  const canManage = myRole >= ADMIN;
  const choices = ROLE_LEVELS.filter((r) => r.level <= myRole).map((r) => ({ value: r.level, label: r.label }));
  const { data: invites = [] } = useBarInvites(barId, canManage);
  const remove = useRemoveInvite(barId);
  const busy = change.isPending || add.isPending || remove.isPending;

  // Admin hands over the keys, so it asks first.
  const confirmRole = (who: string, level: number) =>
    level !== ADMIN ||
    confirmAsync({
      title: `Make ${who} an Admin?`,
      message: 'Admins can change the venue and everyone’s role, including yours.',
      confirmText: 'Make Admin',
    });

  return (
    <View style={styles.section}>
      <SectionTitle>{`Members (${members.length})`}</SectionTitle>
      {canManage ? (
        <Surface style={styles.card}>
          <View style={styles.rowText}>
            <Body>Invite someone</Body>
            <Caption tone="muted">They join when they open your staff link and sign in with this email.</Caption>
          </View>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="name@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          <ChipGroup label="Role for the new member" options={choices} value={newRole} onPick={setNewRole} disabled={busy} />
          {add.error ? <ErrorText>{roleError(add.error)}</ErrorText> : null}
          <Button
            label="Invite"
            disabled={busy || !email.trim()}
            onPress={async () => {
              if (!(await confirmRole(email.trim(), newRole))) return;
              add.mutate({ email, roleLevel: newRole }, { onSuccess: () => setEmail('') });
            }}
          />
        </Surface>
      ) : null}
      {change.error ? <ErrorText>{roleError(change.error)}</ErrorText> : null}
      <Surface style={styles.card}>
        {members.length === 0 ? <Caption tone="muted">No members found.</Caption> : null}
        {members.map((m, i) => {
          const me = m.user_id === myId;
          // Emails are only returned to venue admins (and your own row).
          const who = m.email ?? 'Team member';
          const editable = canManage && !me && !!m.email && m.role_level <= myRole;
          return (
            <View key={m.user_id} style={styles.card}>
              {i > 0 ? <RowDivider /> : null}
              <View style={styles.row}>
                <Body style={styles.rowText}>{me ? `${who} (you)` : who}</Body>
                {editable ? null : <Caption tone="muted">{roleLabel(m.role_level)}</Caption>}
              </View>
              {editable ? (
                <ChipGroup
                  label={`Role for ${who}`}
                  options={choices}
                  value={m.role_level}
                  disabled={busy}
                  onPick={async (level) => {
                    if (await confirmRole(who, level)) change.mutate({ email: m.email!, roleLevel: level });
                  }}
                />
              ) : null}
            </View>
          );
        })}
      </Surface>
      {remove.error ? <ErrorText>{roleError(remove.error)}</ErrorText> : null}
      {invites.length > 0 ? (
        <Surface style={styles.card}>
          {invites.map((inv, i) => (
            <View key={inv.id} style={styles.card}>
              {i > 0 ? <RowDivider /> : null}
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Body>{inv.email}</Body>
                  <Caption tone="muted">{`Invited as ${roleLabel(inv.role_level)}, not joined yet`}</Caption>
                </View>
                <Button
                  variant="ghost"
                  label="Cancel"
                  accessibilityLabel={`Cancel the invite for ${inv.email}`}
                  disabled={busy}
                  onPress={() => remove.mutate(inv.id)}
                />
              </View>
            </View>
          ))}
        </Surface>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  card: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rowText: { flex: 1, gap: 2 },
});
