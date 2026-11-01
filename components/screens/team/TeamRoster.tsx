import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { SectionHeading } from '@/components/screens/settings/SettingsParts';
import { Body, Caption, PressableScale, Surface, Tag, TextLink, useDs } from '@/components/ds';
import { MakerCreditRequests } from '@/components/maker/MakerCreditRequests';
import { JobRequests } from '@/components/screens/profile/JobRequests';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { space, STATUS } from '@/constants/tokens';
import { useUserId } from '@/ctx/AuthContext';
import { useBarInvites, useRemoveInvite, useSendInviteEmail, type BarInvite } from '@/hooks/useBarInvites';
import { useBarMembers, type BarMember } from '@/hooks/useBarDetail';
import { managesTeam, useOnShiftTonight } from '@/hooks/useTeam';
import { useRoleMatrix } from '@/hooks/useVenueRoles';
import { useCanManageStaff } from '@/hooks/useViewAs';
import { plainDbMessage } from '@/lib/dbError';
import { confirmAsync } from '@/lib/dialogs';
import { endsLabel } from '@/lib/roleMatrix';
import { roleLabel } from '@/lib/roles';
import { canOpenMember, invitedDay, personName, TEAM_MANAGE, teamLine, teamSections } from '@/lib/team';

import type { InviteNote } from './InviteSheet';
import { ClaimsToConfirm, JoinRequests } from './JoinRequests';
import { WelcomeMessageRow } from './WelcomeMessage';

const AVATAR = 44;

/**
 * A venue's team as the board draws it (Kept-team): who's asking to join on
 * top, then Admins, Behind the bar, Guests (with the day their role ends),
 * Floor, and Invited. Rows say who's on shift tonight. Someone who manages
 * the team taps a person to open their page; the database decides who may.
 */
export function TeamRoster({ barId, barName, role, note, onNote, selectedId, onOpen }: {
  barId: string;
  barName: string;
  role: number;
  /** What the last invite or resend said. */
  note: InviteNote | null;
  onNote: (note: InviteNote | null) => void;
  /** The person open beside the list on a desktop. */
  selectedId?: string | null;
  onOpen: (member: BarMember) => void;
}) {
  const myId = useUserId();
  const manage = useCanManageStaff(barId);
  const members = useBarMembers(barId);
  const matrix = useRoleMatrix(barId).data ?? [];
  const onShift = useOnShiftTonight(barId);
  const { data: invites = [] } = useBarInvites(barId, manage);
  const cancel = useRemoveInvite(barId);
  const send = useSendInviteEmail(barId);
  // Someone with staff who isn't an Admin can't change, remove or cancel an Admin (the database refuses), so it isn't offered.
  const admin = role >= TEAM_MANAGE;
  const [now] = useState(Date.now);

  if (members.isLoading) return <Caption tone="muted">Loading the team…</Caption>;
  if (members.error) return <Body tone="muted" role="alert">Couldn’t load the team. Check your connection and try again.</Body>;

  const all = members.data ?? [];
  const sections = teamSections(all, (m) => managesTeam(matrix, m), now);
  const error = cancel.error ? (plainDbMessage(cancel.error) ?? 'Couldn’t cancel that invite. Check your connection and try again.') : null;

  const resend = (inv: BarInvite) => {
    onNote(null);
    send.mutate(inv.email, {
      onSuccess: () => onNote({ text: `Invite emailed to ${inv.name || inv.email} again.` }),
      onError: (e) => onNote({ text: `The email didn’t send (${e.message}). They can still join from your staff link.`, failed: true }),
    });
  };
  const cancelInvite = async (inv: BarInvite) => {
    const ok = await confirmAsync({
      title: `Cancel the invite for ${inv.name || inv.email}?`,
      message: 'The link in their email stops working.',
      confirmText: 'Cancel invite',
      destructive: true,
    });
    if (ok) cancel.mutate(inv.id);
  };

  return (
    <View style={styles.roster}>
      {manage ? <JoinRequests barId={barId} /> : null}
      {note ? (
        <Caption tone={note.failed ? 'accent' : 'muted'} role={note.failed ? 'alert' : 'status'}>
          {note.text}
        </Caption>
      ) : null}
      {error ? <Caption color={STATUS.danger} role="alert">{error}</Caption> : null}

      {sections.length === 0 ? <Body tone="muted">No one is on this team yet.</Body> : null}
      {sections.map((g) => (
        <View key={g.key} role="list" aria-label={g.title} style={styles.group}>
          <SectionHeading>{g.title}</SectionHeading>
          <Surface style={styles.card}>
            {g.people.map((m, i) => {
              const ends = g.key === 'guests' ? endsLabel(m.role_ends_at) : null;
              const canOpen = manage && canOpenMember(m, myId, role);
              return (
                <PersonRow
                  key={m.user_id}
                  first={i === 0}
                  name={personName(m)}
                  me={m.user_id === myId}
                  avatar={m.avatar_url}
                  email={m.email}
                  line={teamLine(m, g.key, onShift.has(m.user_id), ends)}
                  tag={ends ? 'Ends' : null}
                  selected={selectedId === m.user_id}
                  onPress={canOpen ? () => onOpen(m) : undefined}
                />
              );
            })}
          </Surface>
        </View>
      ))}

      {manage && invites.length ? (
        <View role="list" aria-label="Invited" style={styles.group}>
          <SectionHeading>Invited</SectionHeading>
          <Surface style={styles.card}>
            {invites.map((inv, i) => {
              const day = invitedDay(inv.created_at, now);
              const canCancel = admin || inv.role_level < TEAM_MANAGE;
              return (
                <PersonRow
                  key={inv.id}
                  first={i === 0}
                  name={inv.name || inv.email}
                  email={inv.email}
                  line={`Invited as ${(inv.venue_role_id && matrix.find((r) => r.role_id === inv.venue_role_id)?.name) || roleLabel(inv.role_level)}${day ? ` · ${day}` : ''}`}
                  trailing={
                    <View style={styles.inviteActions}>
                      <TextLink label="Resend" accessibilityHint={`Emails the invite to ${inv.email} again`} disabled={send.isPending} onPress={() => resend(inv)} />
                      {canCancel ? <TextLink label="Cancel" accessibilityHint={`Cancels the invite for ${inv.name || inv.email}`} onPress={() => void cancelInvite(inv)} /> : null}
                    </View>
                  }
                />
              );
            })}
          </Surface>
        </View>
      ) : null}

      {/* ponytail: not on the board; kept under the list so Admins can still change what every invite says, until the board places it. */}
      {admin ? <WelcomeMessageRow barId={barId} barName={barName} /> : null}
      <ClaimsToConfirm barId={barId} barName={barName} admin={admin} />
      {manage ? <JobRequests venueId={barId} title="Job requests" /> : null}
      {manage ? <MakerCreditRequests venueId={barId} /> : null}
    </View>
  );
}

/** One row: their photo, name and line, and on the right an Ends tag, Resend, or a chevron when it opens their page. */
function PersonRow({ first, name, me, avatar, email, line, tag, selected, onPress, trailing }: {
  first: boolean;
  name: string;
  me?: boolean;
  avatar?: string | null;
  email?: string | null;
  line: string;
  tag?: string | null;
  selected?: boolean;
  onPress?: () => void;
  trailing?: ReactNode;
}) {
  const ds = useDs();
  const content = (
    <>
      <UserAvatar uri={avatar ?? null} name={name} email={email ?? undefined} size={AVATAR} />
      <View style={styles.text}>
        <Body numberOfLines={1}>
          {name}
          {me ? <Body tone="muted"> (you)</Body> : null}
        </Body>
        <Caption tone="muted" numberOfLines={1}>{line}</Caption>
      </View>
      {tag ? <Tag label={tag} /> : null}
      {trailing ?? (onPress ? <IconSymbol name="chevron.right" size={16} color={ds.c.muted} /> : null)}
    </>
  );
  const style = [styles.row, first ? null : { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth }, selected ? { backgroundColor: ds.c.raised } : null];
  if (!onPress) return <View role="listitem" style={style}>{content}</View>;
  return (
    <PressableScale role="button" aria-selected={selected} accessibilityLabel={`${name}, ${line}`} onPress={onPress} style={style}>
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  roster: { gap: space.xl },
  group: { gap: space.sm },
  card: { padding: 0, gap: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg },
  text: { flex: 1, gap: 2, minWidth: 0 },
  inviteActions: { flexDirection: 'row', gap: space.md },
});
