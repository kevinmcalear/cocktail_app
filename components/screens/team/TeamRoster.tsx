import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { RowDivider, SectionHeading } from '@/components/screens/settings/SettingsParts';
import { Body, Button, Caption, DsText, Field, PressableScale, Segmented, Surface, Tag, useDs } from '@/components/ds';
import { MakerCreditRequests } from '@/components/maker/MakerCreditRequests';
import { JobRequests } from '@/components/screens/profile/JobRequests';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { STATUS } from '@/constants/palette';
import { radius, space } from '@/constants/tokens';
import { useUserId } from '@/ctx/AuthContext';
import { useBarInvites, useRemoveInvite, useSendInviteEmail } from '@/hooks/useBarInvites';
import { useBarMembers, useRemoveMember, type BarMember } from '@/hooks/useBarDetail';
import { useRoleMatrix, useSetMemberRoleChoice, type MemberRoleChoice } from '@/hooks/useVenueRoles';
import { useCanManageStaff } from '@/hooks/useViewAs';
import { plainDbMessage } from '@/lib/dbError';
import { confirmAsync } from '@/lib/dialogs';
import { roleLabel } from '@/lib/roles';
import { agoLabel, joinedLabel, memberRoleName, personName, rosterGroups, TEAM_MANAGE, TEAM_SORTS } from '@/lib/team';
import { useTeamSort } from '@/store/useTeamSort';

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
export function TeamRoster({ barId, barName, role, inviting, onCloseInvite }: {
  barId: string;
  barName: string;
  role: number;
  /** My team puts Invite in its title row and opens the sheet from there. */
  inviting: boolean;
  onCloseInvite: () => void;
}) {
  const myId = useUserId();
  const manage = useCanManageStaff(barId);
  const members = useBarMembers(barId);
  const venueRoles = (useRoleMatrix(manage ? barId : null).data ?? []).filter((r) => r.role_id);
  const change = useSetMemberRoleChoice(barId);
  const remove = useRemoveMember(barId);
  const { data: invites = [] } = useBarInvites(barId, manage);
  const cancel = useRemoveInvite(barId);
  const send = useSendInviteEmail(barId);
  const [query, setQuery] = useState('');
  const { sort, setSort } = useTeamSort();
  // For "Invited 2 days ago": read once, so a render never sees the clock move.
  const [now] = useState(Date.now);
  const [note, setNote] = useState<InviteNote | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  // Someone with staff who isn't an Admin can't change, remove or cancel an Admin (the database refuses), so it isn't offered.
  const admin = role >= TEAM_MANAGE;
  const busy = change.isPending || remove.isPending || cancel.isPending || send.isPending;

  if (members.isLoading) return <Caption tone="muted">Loading the team…</Caption>;
  if (members.error) return <Body tone="muted">Couldn’t load the team. Check your connection and try again.</Body>;

  const all = members.data ?? [];
  const groups = rosterGroups(all, manage ? query : '', sort);
  const open = all.find((m) => m.user_id === openId) ?? null;

  const emailInvite = (to: string) => {
    setNote(null);
    send.mutate(to, {
      onSuccess: () => setNote({ text: `Invite emailed to ${to}.` }),
      onError: (e) => setNote({ text: `The email didn’t send (${e.message}). They can still join from your staff link.`, failed: true }),
    });
  };

  const setRole = async (m: BarMember, choice: MemberRoleChoice, label: string, level: number) => {
    const who = personName(m);
    const ok =
      level < TEAM_MANAGE ||
      m.role_level >= TEAM_MANAGE ||
      (await confirmAsync({
        title: label === roleLabel(TEAM_MANAGE) ? `Make ${who} an Admin?` : `Make ${who} ${label}?`,
        message: 'Admins can change the venue and everyone’s role, including yours.',
        confirmText: 'Make Admin',
      }));
    if (ok) change.mutate({ userId: m.user_id, choice });
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
        {manage ? (
          <Field label="Search the team" hideLabel value={query} onChangeText={setQuery} placeholder="Search by name or email" autoCapitalize="none" autoCorrect={false} />
        ) : null}
        <View style={styles.head}>
          <SectionHeading>{`Team · ${all.length}`}</SectionHeading>
          {all.length > 1 ? <Segmented variant="pill" choice accessibilityLabel="Sort the team" options={TEAM_SORTS} value={sort} onChange={setSort} /> : null}
        </View>
        {note ? (
          <Caption tone={note.failed ? 'accent' : 'muted'} role={note.failed ? 'alert' : 'status'}>
            {note.text}
          </Caption>
        ) : null}
        {error && !open ? <ErrorText>{error}</ErrorText> : null}

        {groups.length === 0 ? (
          <Surface style={styles.card}>
            <Body tone="muted" style={styles.empty}>{query.trim() ? 'No one matches that.' : 'No one is on this team yet.'}</Body>
          </Surface>
        ) : null}
        {groups.map((g) => (
          <View key={g.title ?? 'everyone'} style={styles.group}>
            {g.title ? <DsText variant="label" tone="muted" role="heading" style={styles.groupTitle}>{`${g.title} · ${g.people.length}`}</DsText> : null}
            <Surface style={styles.card}>
              {g.people.map((m, i) => (
                <View key={m.user_id}>
                  {i > 0 ? <RowDivider /> : null}
                  <MemberRow
                    member={m}
                    me={m.user_id === myId}
                    showEmail={manage}
                    showRole={!g.title}
                    lineUp={manage}
                    onPress={manage && m.user_id !== myId && (admin || m.role_level < TEAM_MANAGE) ? () => setOpenId(m.user_id) : undefined}
                  />
                </View>
              ))}
            </Surface>
          </View>
        ))}
        {manage ? null : <Caption tone="muted">Only people who can invite and manage staff change roles here.</Caption>}
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
                  ago={agoLabel(inv.created_at, now)}
                  busy={busy}
                  onResend={() => emailInvite(inv.email)}
                  onCancel={admin || inv.role_level < TEAM_MANAGE ? () => cancel.mutate(inv.id) : undefined}
                />
              </View>
            ))}
          </Surface>
          <Caption tone="muted">They join when they accept, from the email or your staff link. You can change their role once they’re in.</Caption>
        </View>
      ) : null}

      {manage ? <JobRequests venueId={barId} title="Job requests" /> : null}
      {manage ? <MakerCreditRequests venueId={barId} /> : null}

      {manage ? (
        <>
          <InviteSheet visible={inviting} onClose={onCloseInvite} barId={barId} barName={barName} ceiling={role} onDone={setNote} />
          <MemberSheet member={open} barName={barName} ceiling={role} venueRoles={venueRoles} busy={busy} onClose={() => setOpenId(null)} onRole={setRole} onRemove={removeMember} />
        </>
      ) : null}
    </View>
  );
}

/** A teammate: photo, name, a line about them, and their role. Opens their sheet when an Admin can manage them. */
function MemberRow({ member, me, showEmail, showRole, lineUp, onPress }: {
  member: BarMember;
  me: boolean;
  showEmail: boolean;
  /** Off under a role heading, which already names it. */
  showRole: boolean;
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
      {showRole ? <Tag label={memberRoleName(member)} tone={member.role_level >= TEAM_MANAGE ? 'accent' : 'default'} style={styles.tag} /> : null}
      {onPress ? <IconSymbol name="chevron.right" size={CHEVRON} color={ds.c.muted} /> : lineUp ? <View style={styles.chevronSpace} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <PressableScale role="button" onPress={onPress} accessibilityLabel={`${name}, ${memberRoleName(member)}. Manage`} style={styles.row}>
      {content}
    </PressableScale>
  );
}

function InviteRow({ name, email, roleLevel, ago, busy, onResend, onCancel }: {
  name?: string | null;
  email: string;
  roleLevel: number;
  ago: string | null;
  busy: boolean;
  onResend: () => void;
  onCancel?: () => void;
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
          <Caption tone="muted" numberOfLines={1}>{`${name ? `${email} · ` : ''}Invited as ${roleLabel(roleLevel)}${ago ? ` · ${ago}` : ''}`}</Caption>
        </View>
      </View>
      <View style={styles.inviteActions}>
        <Button label="Resend" variant="ghost" accessibilityLabel={`Email the invite to ${email} again`} disabled={busy} onPress={onResend} size="sm" />
        {onCancel ? <Button label="Cancel" variant="ghost" accessibilityLabel={`Cancel the invite for ${email}`} disabled={busy} onPress={onCancel} size="sm" /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  roster: { gap: space.xl },
  section: { gap: space.md },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  group: { gap: space.sm },
  groupTitle: { paddingHorizontal: space.lg },
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
});
