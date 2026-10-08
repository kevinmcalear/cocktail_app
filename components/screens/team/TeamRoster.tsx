import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { RowDivider, SectionHeading } from '@/components/screens/settings/SettingsParts';
import { Body, Button, Caption, Field, PressableScale, Surface, Tag, useDs } from '@/components/ds';
import { JobRequests } from '@/components/screens/profile/JobRequests';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { STATUS } from '@/constants/palette';
import { radius, space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useBarInvites, useRemoveInvite, useSendInviteEmail } from '@/hooks/useBarInvites';
import { useBarMembers, useRemoveMember, useSetMemberRole, type BarMember } from '@/hooks/useBarDetail';
import { plainDbMessage } from '@/lib/dbError';
import { confirmAsync } from '@/lib/dialogs';
import { roleLabel } from '@/lib/roles';
import { canManageTeam, joinedLabel, personName, roster, TEAM_MANAGE } from '@/lib/team';

import { InviteSheet, type InviteNote } from './InviteSheet';
import { MemberSheet } from './MemberSheet';

const AVATAR = 44;
const CHEVRON = 16;

/** What went wrong, read out when it appears. Status red, never the accent. */
function ErrorText({ children }: { children: string }) {
  return (
    <Caption color={STATUS.danger} role="alert">
      {children}
    </Caption>
  );
}

function problem(error: unknown): string | null {
  if (!error) return null;
  return plainDbMessage(error) ?? "Couldn't save that. Check your connection and try again.";
}

/**
 * A venue's team: everyone on it with their photo and role, and for an Admin,
 * look-up, invites, and a sheet per person to change their role or remove
 * them. The database decides who may; this only hides the controls.
 */
export function TeamRoster({ barId, barName, role }: { barId: string; barName: string; role: number }) {
  const myId = useAuth().user?.id;
  const manage = canManageTeam(role);
  const members = useBarMembers(barId);
  const change = useSetMemberRole(barId);
  const remove = useRemoveMember(barId);
  const { data: invites = [] } = useBarInvites(barId, manage);
  const cancel = useRemoveInvite(barId);
  const send = useSendInviteEmail(barId);
  const [query, setQuery] = useState('');
  const [inviting, setInviting] = useState(false);
  const [note, setNote] = useState<InviteNote | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const busy = change.isPending || remove.isPending || cancel.isPending || send.isPending;

  if (members.isLoading) return <Caption tone="muted">Loading the team…</Caption>;
  if (members.error) return <Body tone="muted">Couldn’t load the team. Check your connection and try again.</Body>;

  const all = members.data ?? [];
  const people = roster(all, manage ? query : '');
  const open = all.find((m) => m.user_id === openId) ?? null;

  const emailInvite = (to: string) => {
    setNote(null);
    send.mutate(to, {
      onSuccess: () => setNote({ text: `Invite emailed to ${to}.` }),
      onError: (e) => setNote({ text: `The email didn’t send (${e.message}). They can still join from your staff link.`, failed: true }),
    });
  };

  const setRole = async (m: BarMember, level: number) => {
    const who = personName(m);
    const ok =
      level !== TEAM_MANAGE ||
      (await confirmAsync({
        title: `Make ${who} an Admin?`,
        message: 'Admins can change the venue and everyone’s role, including yours.',
        confirmText: 'Make Admin',
      }));
    if (ok && m.email) change.mutate({ email: m.email, roleLevel: level });
  };

  const removeMember = async (m: BarMember) => {
    const ok = await confirmAsync({
      title: `Remove ${personName(m)}?`,
      message: `They lose access to ${barName}.`,
      confirmText: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    remove.mutate(m.user_id, { onSuccess: () => setOpenId(null) });
  };

  const error = problem(change.error) || problem(remove.error) || problem(cancel.error);

  return (
    <View style={styles.roster}>
      <View style={styles.section}>
        <SectionHeading>{`Team · ${all.length}`}</SectionHeading>
        {manage ? (
          <View style={styles.toolbar}>
            <View style={styles.search}>
              <Field label="Look up" value={query} onChangeText={setQuery} placeholder="Name or email" autoCapitalize="none" autoCorrect={false} />
            </View>
            <Button label="Invite someone" icon="person.badge.plus" onPress={() => setInviting(true)} disabled={busy} />
          </View>
        ) : null}
        {note ? (
          <Caption tone={note.failed ? 'accent' : 'muted'} role={note.failed ? 'alert' : 'status'}>
            {note.text}
          </Caption>
        ) : null}
        {error && !open ? <ErrorText>{error}</ErrorText> : null}

        <Surface style={styles.card}>
          {people.length === 0 ? (
            <Body tone="muted" style={styles.empty}>{query.trim() ? 'No one matches that.' : 'No one is on this team yet.'}</Body>
          ) : null}
          {people.map((m, i) => (
            <View key={m.user_id}>
              {i > 0 ? <RowDivider /> : null}
              <MemberRow
                member={m}
                me={m.user_id === myId}
                showEmail={manage}
                lineUp={manage}
                onPress={manage && m.user_id !== myId && m.email ? () => setOpenId(m.user_id) : undefined}
              />
            </View>
          ))}
        </Surface>
        {manage ? null : <Caption tone="muted">Only Admins can invite people or change roles.</Caption>}
      </View>

      {invites.length > 0 ? (
        <View style={styles.section}>
          <SectionHeading>{`Invited, not joined yet · ${invites.length}`}</SectionHeading>
          <Surface style={styles.card}>
            {invites.map((inv, i) => (
              <View key={inv.id}>
                {i > 0 ? <RowDivider /> : null}
                <InviteRow
                  name={inv.name}
                  email={inv.email}
                  roleLevel={inv.role_level}
                  busy={busy}
                  onResend={() => emailInvite(inv.email)}
                  onCancel={() => cancel.mutate(inv.id)}
                />
              </View>
            ))}
          </Surface>
        </View>
      ) : null}

      {manage ? <JobRequests venueId={barId} title="Job requests" /> : null}

      {manage ? (
        <>
          <InviteSheet visible={inviting} onClose={() => setInviting(false)} barId={barId} barName={barName} ceiling={role} onDone={setNote} />
          <MemberSheet member={open} barName={barName} ceiling={role} busy={busy} onClose={() => setOpenId(null)} onRole={setRole} onRemove={removeMember} />
        </>
      ) : null}
    </View>
  );
}

/** A teammate: photo, name, a line about them, and their role. Opens their sheet when an Admin can manage them. */
function MemberRow({ member, me, showEmail, lineUp, onPress }: {
  member: BarMember;
  me: boolean;
  showEmail: boolean;
  /** Keeps role tags in a column when other rows have a chevron. */
  lineUp: boolean;
  onPress?: () => void;
}) {
  const ds = useDs();
  const name = personName(member);
  const joined = joinedLabel(member.joined_at);
  // An Admin needs the email to tell people apart; the date is in their sheet.
  const line = showEmail ? member.email : joined;
  const content = (
    <>
      <UserAvatar uri={member.avatar_url} name={name} email={member.email} size={AVATAR} />
      <View style={styles.text}>
        <Body numberOfLines={2}>
          {name}
          {me ? <Body tone="muted"> (you)</Body> : null}
        </Body>
        {line ? <Caption tone="muted" numberOfLines={1}>{line}</Caption> : null}
      </View>
      <Tag label={roleLabel(member.role_level)} tone={member.role_level >= TEAM_MANAGE ? 'accent' : 'default'} style={styles.tag} />
      {onPress ? <IconSymbol name="chevron.right" size={CHEVRON} color={ds.c.muted} /> : lineUp ? <View style={styles.chevronSpace} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <PressableScale role="button" onPress={onPress} accessibilityLabel={`${name}, ${roleLabel(member.role_level)}. Manage`} style={styles.row}>
      {content}
    </PressableScale>
  );
}

function InviteRow({ name, email, roleLevel, busy, onResend, onCancel }: {
  name?: string | null;
  email: string;
  roleLevel: number;
  busy: boolean;
  onResend: () => void;
  onCancel: () => void;
}) {
  const ds = useDs();
  return (
    <View style={styles.inviteRow}>
      <View style={[styles.row, styles.inviteMain]}>
        <View style={[styles.envelope, { backgroundColor: ds.c.raised }]}>
          <IconSymbol name="envelope" size={20} color={ds.c.muted} />
        </View>
        <View style={styles.text}>
          <Body numberOfLines={1}>{name || email}</Body>
          <Caption tone="muted" numberOfLines={1}>{`${name ? `${email} · ` : ''}Invited as ${roleLabel(roleLevel)}`}</Caption>
        </View>
      </View>
      <View style={styles.inviteActions}>
        <Button label="Resend" variant="ghost" accessibilityLabel={`Email the invite to ${email} again`} disabled={busy} onPress={onResend} style={styles.compact} />
        <Button label="Cancel" variant="ghost" accessibilityLabel={`Cancel the invite for ${email}`} disabled={busy} onPress={onCancel} style={styles.compact} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  roster: { gap: space.xl },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: space.md },
  search: { flexGrow: 1, flexBasis: 240 },
  section: { gap: space.md },
  card: { paddingVertical: space.xs, gap: 0 },
  empty: { paddingVertical: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  inviteMain: { flexGrow: 1, flexBasis: 260 },
  text: { flex: 1, gap: 2, minWidth: 0 },
  tag: { alignSelf: 'center' },
  chevronSpace: { width: CHEVRON },
  envelope: { width: AVATAR, height: AVATAR, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  inviteRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.md },
  inviteActions: { flexDirection: 'row', marginLeft: 'auto' },
  compact: { paddingHorizontal: space.md },
});
