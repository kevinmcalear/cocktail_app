import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { Body, Button, Caption, Field } from '@/components/ds';
import { Choice, MenuSheet } from '@/components/screens/menus/MenuSheet';
import { space } from '@/constants/tokens';
import { useSetMemberRole } from '@/hooks/useBarDetail';
import { useSaveWelcomeMessage, useSendInviteEmail, useWelcomeMessage } from '@/hooks/useBarInvites';
import { useMyProfile } from '@/hooks/useMyProfile';
import { plainDbMessage } from '@/lib/dbError';
import { confirmAsync } from '@/lib/dialogs';
import { focusInModal, MODAL_AUTOFOCUS } from '@/lib/modalAutoFocus';
import { roleLabel } from '@/lib/roles';
import { INVITE_ROLES, inviteButtonLabel, NOTE_MAX, TEAM_MANAGE, welcomeSuggestion } from '@/lib/team';

import { InvitePreview } from './InvitePreview';

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
 * Invite someone to the venue: their name, email, what they can do, and a
 * note just for them under the welcome message (invite-team-last, step 6).
 * Saves the invite (add_user_to_bar_by_email), then emails it
 * (send-bar-invite). An email that's already on the team just gets the new
 * role. An Admin's first invite saves the suggested welcome message too, as
 * Your team would have.
 */
export function InviteSheet({ visible, onClose, barId, barName, ceiling, admin, onDone }: InviteSheetProps) {
  const add = useSetMemberRole(barId);
  const send = useSendInviteEmail(barId);
  const saved = useWelcomeMessage(barId);
  const saveWelcome = useSaveWelcomeMessage(barId);
  const sender = useMyProfile().data?.displayName?.trim() || null;
  const welcome = saved.data ?? (admin ? welcomeSuggestion(barName) : '');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [picked, setRole] = useState(BARTENDER);
  // The ceiling can drop once the inviter's permissions load, so the pick follows it down.
  const role = Math.min(picked, ceiling);
  const [problem, setProblem] = useState<string | null>(null);
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const busy = add.isPending || send.isPending;
  const roles = INVITE_ROLES.filter((r) => r.level <= ceiling);

  const finish = (note: InviteNote) => {
    setName('');
    setEmail('');
    setNote('');
    setPreviewing(false);
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
      if (saved.data === null && admin) await saveWelcome.mutateAsync(welcome);
      invited = await add.mutateAsync({ email: to, roleLevel: role, name, note });
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
      footer={
        <View style={styles.footer}>
          <Button label={busy ? 'Sending…' : inviteButtonLabel(name)} size="lg" onPress={submit} disabled={busy} />
          <Button label={previewing ? 'Hide the email' : 'Preview the email'} variant="ghost" onPress={() => setPreviewing((on) => !on)} />
        </View>
      }
    >
      {/* iOS offers a contact's name and email (textContentType); autoComplete stays off so a browser doesn't fill in your own. */}
      <Field
        ref={nameRef}
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Sam Okafor"
        autoComplete="off"
        textContentType="name"
        autoCapitalize="words"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => emailRef.current?.focus()}
        maxLength={80}
        autoFocus={MODAL_AUTOFOCUS}
      />
      <Field
        ref={emailRef}
        label="Email"
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
      <Caption tone="muted">What they can do</Caption>
      <View role="radiogroup" accessibilityLabel="What they can do" style={styles.list}>
        {roles.map((r) => (
          <Choice key={r.level} label={roleLabel(r.level)} detail={r.detail} selected={role === r.level} onPress={() => setRole(r.level)} />
        ))}
      </View>
      <Field
        label={`A note just for ${name.trim().split(/\s+/)[0] || 'them'} (optional)`}
        value={note}
        onChangeText={setNote}
        minLines={3}
        maxLength={NOTE_MAX}
        hint={welcome ? 'Goes under your welcome message.' : undefined}
      />
      {previewing ? <InvitePreview barId={barId} barName={barName} roleLevel={role} sender={sender} welcome={welcome} note={note} /> : null}
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
  footer: { gap: space.sm },
});
