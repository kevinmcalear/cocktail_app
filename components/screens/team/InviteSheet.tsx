import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { Body, Button, Caption, Field, Segmented } from '@/components/ds';
import { Choice, MenuSheet } from '@/components/screens/menus/MenuSheet';
import { space } from '@/constants/tokens';
import { useSetMemberRole } from '@/hooks/useBarDetail';
import { useSaveWelcomeMessage, useSendInviteEmail, useWelcomeMessage } from '@/hooks/useBarInvites';
import { useInviteToRole } from '@/hooks/useTakeover';
import { useRoleMatrix } from '@/hooks/useVenueRoles';
import { plainDbMessage } from '@/lib/dbError';
import { confirmAsync } from '@/lib/dialogs';
import { focusInModal, MODAL_AUTOFOCUS } from '@/lib/modalAutoFocus';
import { inviteRoleOptions, looksLikeEmail, TEAM_MANAGE, welcomeSuggestion } from '@/lib/team';

import { StaffLinkTab } from './StaffLinkTab';

/** What happened, for the Team screen to say once the sheet closes. */
export interface InviteNote {
  text: string;
  failed?: boolean;
}

interface InviteSheetProps {
  visible: boolean;
  onClose: () => void;
  barId: string;
  barName: string;
  /** The highest role the inviter may hand out: nobody invites above it. */
  ceiling: number;
  /** An Admin: the only one who can save the welcome message, so the only one it starts filled in for. */
  admin: boolean;
  onDone: (note: InviteNote) => void;
}

const BARTENDER = 30;

/**
 * Invite to the venue (Kept-team): the Staff link tab, or By email as the
 * board draws it: one "Name or email" field, an As list of the bar's own roles
 * (its custom ones too) and Send invite. An email stands alone; a name asks
 * for an email. Saves the invite (add_user_to_bar_by_email for a built-in
 * role, invite_to_role for a custom one), then emails it (send-bar-invite).
 * An email that's already on the team just gets the new built-in role. An
 * Admin's first invite saves the suggested welcome message too, as Your team
 * would have.
 */
export function InviteSheet({ visible, onClose, barId, barName, ceiling, admin, onDone }: InviteSheetProps) {
  const add = useSetMemberRole(barId);
  const addToRole = useInviteToRole();
  const send = useSendInviteEmail(barId);
  const saved = useWelcomeMessage(barId);
  const saveWelcome = useSaveWelcomeMessage(barId);
  const matrix = useRoleMatrix(barId);
  // Until it's read, nothing: the email never promises a welcome it won't carry.
  const welcome = saved.isSuccess ? (saved.data ?? (admin ? welcomeSuggestion(barName) : '')) : '';
  const [tab, setTab] = useState<'link' | 'email'>('link');
  const [who, setWho] = useState('');
  const [email, setEmail] = useState('');
  const [picked, setPicked] = useState(`level:${BARTENDER}`);
  const [problem, setProblem] = useState<string | null>(null);
  const whoRef = useRef<ComponentRef<typeof TextInput>>(null);
  const busy = add.isPending || addToRole.isPending || send.isPending;
  const roles = inviteRoleOptions(ceiling, matrix.data);
  // The ceiling can drop once the inviter's permissions load, or a role can end, so the pick follows what's offered.
  const role = roles.find((r) => r.key === picked) ?? roles.find((r) => r.level === BARTENDER) ?? roles[0];
  // An email stands alone; a name asks for one.
  const typed = who.trim();
  const byEmail = looksLikeEmail(typed);
  const name = byEmail ? '' : typed;
  const to = (byEmail ? typed : email.trim()).toLowerCase();

  const close = () => {
    setTab('link');
    onClose();
  };

  const finish = (note: InviteNote) => {
    setWho('');
    setEmail('');
    setProblem(null);
    onDone(note);
    close();
  };

  const submit = async () => {
    if (!typed) return setProblem('Add a name or an email.');
    if (!to) return setProblem(`Add ${name.split(/\s+/)[0]}’s email.`);
    if (!role) return setProblem('Pick what they can do.');
    const label = name || to;
    if (role.level === TEAM_MANAGE) {
      const ok = await confirmAsync({
        title: `Make ${label} an Admin?`,
        message: 'Admins can change the venue and everyone’s role, including yours.',
        confirmText: 'Make Admin',
      });
      if (!ok) return;
    }
    setProblem(null);
    let invited = true;
    try {
      if (saved.isSuccess && saved.data === null && admin) await saveWelcome.mutateAsync(welcome);
      if (role.roleId) await addToRole.mutateAsync({ email: to, roleId: role.roleId, name });
      else invited = await add.mutateAsync({ email: to, roleLevel: role.level, name });
    } catch (e) {
      return setProblem(plainDbMessage(e) ?? 'Couldn’t save that. Check your connection and try again.');
    }
    if (!invited) return finish({ text: `${to} is already on the team. They’re ${role.label} now.` });
    try {
      await send.mutateAsync(to);
      finish({ text: `Invite emailed to ${label}.` });
    } catch (e) {
      const why = e instanceof Error ? e.message : 'no reason given';
      finish({ text: `The invite is saved, but the email didn’t send (${why}). They can still join from your staff link.`, failed: true });
    }
  };

  return (
    <MenuSheet
      visible={visible}
      onClose={close}
      title={`Invite to ${barName}`}
      onShow={MODAL_AUTOFOCUS || tab === 'link' ? undefined : () => focusInModal(whoRef)}
      footer={tab === 'link' ? undefined : <Button label={busy ? 'Sending…' : 'Send invite'} size="lg" onPress={submit} disabled={busy} />}
    >
      <Segmented
        accessibilityLabel="How to invite"
        variant="pill"
        stretch
        value={tab}
        onChange={setTab}
        options={[{ value: 'link', label: 'Staff link' }, { value: 'email', label: 'By email' }]}
      />
      {tab === 'link' ? <StaffLinkTab barId={barId} barName={barName} ceiling={ceiling} admin={admin} /> : null}
      {tab === 'email' ? (
        <>
          {/* autoComplete stays off so a browser doesn't fill in your own email. */}
          <Field
            ref={whoRef}
            label="Name or email"
            value={who}
            onChangeText={setWho}
            placeholder="Sam Okafor, or sam@example.com"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            maxLength={120}
            autoFocus={MODAL_AUTOFOCUS && tab === 'email'}
          />
          {name ? (
            <Field
              label={`${name.split(/\s+/)[0]}’s email`}
              value={email}
              onChangeText={setEmail}
              placeholder="sam@example.com"
              autoComplete="off"
              textContentType="emailAddress"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="done"
            />
          ) : null}
          <Caption tone="muted">As</Caption>
          <View role="radiogroup" accessibilityLabel="As" style={styles.list}>
            {roles.map((r) => (
              <Choice key={r.key} label={r.label} detail={r.detail} selected={role?.key === r.key} onPress={() => setPicked(r.key)} />
            ))}
          </View>
          {problem ? (
            <Body tone="accent" role="alert">
              {problem}
            </Body>
          ) : null}
        </>
      ) : null}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
});
