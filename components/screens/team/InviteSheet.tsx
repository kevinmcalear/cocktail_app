import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { Body, Button, Caption, Field } from '@/components/ds';
import { Choice, MenuSheet } from '@/components/screens/menus/MenuSheet';
import { space } from '@/constants/tokens';
import { useSetMemberRole } from '@/hooks/useBarDetail';
import { useSendInviteEmail } from '@/hooks/useBarInvites';
import { plainDbMessage } from '@/lib/dbError';
import { confirmAsync } from '@/lib/dialogs';
import { focusInModal, MODAL_AUTOFOCUS } from '@/lib/modalAutoFocus';
import { roleLabel } from '@/lib/roles';
import { INVITE_ROLES, inviteButtonLabel, TEAM_MANAGE } from '@/lib/team';

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
  /** The inviter's own role: nobody invites above it. */
  ceiling: number;
  onDone: (note: InviteNote) => void;
}

const BARTENDER = 30;

/**
 * Invite someone to the venue: their name, email, and what they can do. Saves
 * the invite (add_user_to_bar_by_email), then emails it (send-bar-invite). An
 * email that's already on the team just gets the new role.
 */
export function InviteSheet({ visible, onClose, barId, barName, ceiling, onDone }: InviteSheetProps) {
  const add = useSetMemberRole(barId);
  const send = useSendInviteEmail(barId);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(Math.min(BARTENDER, ceiling));
  const [problem, setProblem] = useState<string | null>(null);
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const busy = add.isPending || send.isPending;
  const roles = INVITE_ROLES.filter((r) => r.level <= ceiling);

  const finish = (note: InviteNote) => {
    setName('');
    setEmail('');
    setProblem(null);
    onDone(note);
    onClose();
  };

  const submit = async () => {
    const to = email.trim().toLowerCase();
    if (!to) return setProblem('Add their email.');
    const who = name.trim() || to;
    if (role === TEAM_MANAGE) {
      const ok = await confirmAsync({
        title: `Make ${who} an Admin?`,
        message: 'Admins can change the venue and everyone’s role, including yours.',
        confirmText: 'Make Admin',
      });
      if (!ok) return;
    }
    setProblem(null);
    let invited: boolean;
    try {
      invited = await add.mutateAsync({ email: to, roleLevel: role, name });
    } catch (e) {
      return setProblem(plainDbMessage(e) ?? 'Couldn’t save that. Check your connection and try again.');
    }
    if (!invited) return finish({ text: `${to} is already on the team. They’re ${roleLabel(role)} now.` });
    try {
      await send.mutateAsync(to);
      finish({ text: `Invite emailed to ${who}.` });
    } catch (e) {
      const why = e instanceof Error ? e.message : 'no reason given';
      finish({ text: `The invite is saved, but the email didn’t send (${why}). They can still join from your staff link.`, failed: true });
    }
  };

  return (
    <MenuSheet
      visible={visible}
      onClose={onClose}
      title={`Invite to ${barName}`}
      onShow={MODAL_AUTOFOCUS ? undefined : () => focusInModal(nameRef)}
      footer={<Button label={busy ? 'Sending…' : inviteButtonLabel(name)} size="lg" onPress={submit} disabled={busy} />}
    >
      <Field ref={nameRef} label="Name" value={name} onChangeText={setName} placeholder="Sam Okafor" autoComplete="off" maxLength={80} autoFocus={MODAL_AUTOFOCUS} />
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="sam@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
      />
      <Caption tone="muted">What they can do</Caption>
      <View role="radiogroup" accessibilityLabel="What they can do" style={styles.list}>
        {roles.map((r) => (
          <Choice key={r.level} label={roleLabel(r.level)} detail={r.detail} selected={role === r.level} onPress={() => setRole(r.level)} />
        ))}
      </View>
      {problem ? (
        <Body tone="accent" role="alert">
          {problem}
        </Body>
      ) : null}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
});
