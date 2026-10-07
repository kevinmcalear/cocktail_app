import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, Chip, Display, Field, Headline, LockedSection, useDs, useGutter } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useBarInvites, useRemoveInvite, useSendInviteEmail } from '@/hooks/useBarInvites';
import { useBarMembers, useRemoveMember, useSetMemberRole, type BarMember } from '@/hooks/useBarDetail';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useMode } from '@/hooks/useMode';
import { useEffectiveRole } from '@/hooks/useViewAs';
import { plainDbMessage } from '@/lib/dbError';
import { confirmAsync } from '@/lib/dialogs';
import { ROLE_LEVELS, roleLabel } from '@/lib/roles';
import { canManageTeam, canSeeTeam, joinedLabel, personName, roster, TEAM_MANAGE } from '@/lib/team';

import { InviteSheet, type InviteNote } from './InviteSheet';

function problem(error: unknown): string | null {
  if (!error) return null;
  return plainDbMessage(error) ?? "Couldn't save that. Check your connection and try again.";
}

function Roles({ label, value, ceiling, disabled, onPick }: {
  label: string;
  value: number;
  ceiling: number;
  disabled: boolean;
  onPick: (level: number) => void;
}) {
  return (
    <View role="radiogroup" aria-label={label} style={styles.roles}>
      {ROLE_LEVELS.filter((r) => r.level <= ceiling).map((r) => (
        <Chip
          key={r.level}
          label={r.label}
          selected={r.level === value}
          onPress={() => {
            if (!disabled && r.level !== value) onPick(r.level);
          }}
        />
      ))}
    </View>
  );
}

/**
 * My team, for the venue in the sidebar. Employee and above see who is on it.
 * An Admin can look someone up, invite by name and email (we email them the
 * invite), change a role, or remove them.
 * The database decides who may; this only hides the controls.
 */
export function TeamScreen() {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const sidebar = useIsWideWeb();
  const myId = useAuth().user?.id;
  const home = useMode().mode === 'home';
  const { active } = useActiveVenue();
  const role = useEffectiveRole(active?.id ?? null);
  const visible = !home && !!active && canSeeTeam(role);
  const manage = visible && canManageTeam(role);
  const barId = visible ? active.id : null;
  const members = useBarMembers(barId);
  const change = useSetMemberRole(barId ?? '');
  const remove = useRemoveMember(barId ?? '');
  const { data: invites = [] } = useBarInvites(barId ?? '', manage);
  const cancel = useRemoveInvite(barId ?? '');
  const send = useSendInviteEmail(barId ?? '');
  const [query, setQuery] = useState('');
  const [inviting, setInviting] = useState(false);
  const [note, setNote] = useState<InviteNote | null>(null);
  const busy = change.isPending || remove.isPending || cancel.isPending || send.isPending;
  const emailInvite = (to: string) => {
    setNote(null);
    send.mutate(to, {
      onSuccess: () => setNote({ text: `Invite emailed to ${to}.` }),
      onError: (e) => setNote({ text: `The email didn’t send (${e.message}). They can still join from your staff link.`, failed: true }),
    });
  };
  const people = roster(members.data ?? [], manage ? query : '');

  const confirmRole = (who: string, level: number) =>
    level !== TEAM_MANAGE ||
    confirmAsync({
      title: `Make ${who} an Admin?`,
      message: 'Admins can change the venue and everyone’s role, including yours.',
      confirmText: 'Make Admin',
    });

  let body: ReactNode;
  if (home || !active) body = <Body tone="muted">My team is part of a venue. Switch to your bar to see it.</Body>;
  else if (!visible) body = <Body tone="muted">My team opens at Employee.</Body>;
  else if (members.isLoading) body = <Caption tone="muted">Loading the team…</Caption>;
  else if (members.error) body = <Body tone="muted">Couldn’t load the team. Check your connection and try again.</Body>;
  else
    body = (
      <>
        <LockedSection title="Manage the team" unlocked={manage} opensAt="Admin">
          <Field label="Look up" value={query} onChangeText={setQuery} placeholder="Name or email" autoCapitalize="none" autoCorrect={false} />
          <Button label="Invite someone" onPress={() => setInviting(true)} disabled={busy} style={styles.invite} />
          {note ? (
            <Caption tone={note.failed ? 'accent' : 'muted'} role={note.failed ? 'alert' : 'status'}>
              {note.text}
            </Caption>
          ) : null}
          {invites.map((i) => (
            <View key={i.id} style={styles.inviteRow}>
              <Caption>{`${i.name ? `${i.name}, ` : ''}${i.email} · invited as ${roleLabel(i.role_level)}`}</Caption>
              <View style={styles.inviteActions}>
                <Button label="Email again" variant="ghost" disabled={busy} onPress={() => emailInvite(i.email)} />
                <Button label="Cancel invite" variant="ghost" disabled={busy} onPress={() => cancel.mutate(i.id)} />
              </View>
            </View>
          ))}
        </LockedSection>
        {manage && active ? (
          <InviteSheet visible={inviting} onClose={() => setInviting(false)} barId={active.id} barName={active.name} ceiling={role} onDone={setNote} />
        ) : null}
        {problem(change.error) || problem(remove.error) || problem(cancel.error) ? (
          <Caption tone="accent" role="alert">{problem(change.error) || problem(remove.error) || problem(cancel.error)}</Caption>
        ) : null}
        {people.length === 0 ? (
          <Body tone="muted">{query.trim() ? 'No one matches that.' : 'No one is on this team yet.'}</Body>
        ) : null}
        {people.map((m) => (
          <Person
            key={m.user_id}
            member={m}
            me={m.user_id === myId}
            manage={manage}
            ceiling={role}
            busy={busy}
            onRole={async (level) => {
              const who = personName(m);
              if (m.email && (await confirmRole(who, level))) change.mutate({ email: m.email, roleLevel: level });
            }}
            onRemove={async () => {
              const who = personName(m);
              const ok = await confirmAsync({
                title: `Remove ${who}?`,
                message: 'They lose access to this venue.',
                confirmText: 'Remove',
                destructive: true,
              });
              if (ok) remove.mutate(m.user_id);
            }}
          />
        ))}
      </>
    );

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + (sidebar ? space.xxl : space.sm), paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxxl },
        ]}
      >
        <Display>My team</Display>
        {active && visible ? <Caption tone="muted">{active.name}</Caption> : null}
        {body}
      </ScrollView>
    </View>
  );
}

function Person({ member, me, manage, ceiling, busy, onRole, onRemove }: {
  member: BarMember;
  me: boolean;
  manage: boolean;
  ceiling: number;
  busy: boolean;
  onRole: (level: number) => void;
  onRemove: () => void;
}) {
  const ds = useDs();
  const name = personName(member);
  const who = me ? `${name} (you)` : name;
  const editable = manage && !me && !!member.email;
  const joined = joinedLabel(member.joined_at);
  return (
    <View style={[styles.person, { borderBottomColor: ds.c.line }]}>
      <Headline>{who}</Headline>
      {manage && member.email ? <Caption>{member.email}</Caption> : null}
      {joined ? <Caption tone="muted">{joined}</Caption> : null}
      {editable ? (
        <Roles label={`Role for ${who}`} value={member.role_level} ceiling={ceiling} disabled={busy} onPick={onRole} />
      ) : (
        <Caption tone="muted">{roleLabel(member.role_level)}</Caption>
      )}
      {editable ? <Button label="Remove" variant="secondary" disabled={busy} onPress={onRemove} style={styles.remove} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: space.lg, maxWidth: 760, width: '100%' },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  invite: { alignSelf: 'flex-start' },
  inviteRow: { gap: space.xs },
  inviteActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  person: { gap: space.xs, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  remove: { alignSelf: 'flex-start' },
});
