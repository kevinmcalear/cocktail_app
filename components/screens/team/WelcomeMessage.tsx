import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field, PressableScale, Surface, useDs } from '@/components/ds';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';
import { useSaveWelcomeMessage, useWelcomeMessage } from '@/hooks/useBarInvites';
import { useMyProfile } from '@/hooks/useMyProfile';
import { plainDbMessage } from '@/lib/dbError';
import { WELCOME_MAX, welcomeSuggestion } from '@/lib/team';

import { InvitePreview } from './InvitePreview';

const BARTENDER = 30;

/**
 * My team's Welcome message row, for Admins (invite-team-last, step 6): the
 * message every invite carries, opened to change once. Until it's first
 * saved it reads as the suggestion, which is what Your team starts with.
 */
export function WelcomeMessageRow({ barId, barName }: { barId: string; barName: string }) {
  const ds = useDs();
  const saved = useWelcomeMessage(barId);
  const [open, setOpen] = useState(false);
  if (saved.isLoading || saved.error) return null;
  const message = saved.data ?? welcomeSuggestion(barName);
  return (
    <>
      <Surface style={styles.card}>
        <PressableScale role="button" accessibilityLabel="Welcome message. Change" onPress={() => setOpen(true)} style={styles.row}>
          <View style={styles.text}>
            <Body>Welcome message</Body>
            <Caption tone="muted" numberOfLines={1}>{message || 'None: invites go straight to Join.'}</Caption>
          </View>
          <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
        </PressableScale>
      </Surface>
      {/* Mounted while open, so it starts from what's saved each time. */}
      {open ? <WelcomeSheet barId={barId} barName={barName} message={message} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function WelcomeSheet({ barId, barName, message, onClose }: { barId: string; barName: string; message: string; onClose: () => void }) {
  const save = useSaveWelcomeMessage(barId);
  const sender = useMyProfile().data?.displayName?.trim() || null;
  const [text, setText] = useState(message);
  const [previewing, setPreviewing] = useState(false);
  return (
    <MenuSheet
      visible
      onClose={onClose}
      title="Welcome message"
      footer={
        <View style={styles.footer}>
          <Button label={save.isPending ? 'Saving…' : 'Save'} size="lg" disabled={save.isPending} onPress={() => save.mutate(text, { onSuccess: onClose })} />
          <Button label={previewing ? 'Hide the email' : 'Preview the email'} variant="ghost" onPress={() => setPreviewing((on) => !on)} />
        </View>
      }
    >
      <Caption tone="muted">{`Goes in every invite from ${barName}, signed with the name of whoever sends it.`}</Caption>
      <Field label="The message" hideLabel value={text} onChangeText={setText} minLines={4} maxLength={WELCOME_MAX} />
      {save.error ? (
        <Body tone="accent" role="alert">
          {plainDbMessage(save.error) ?? 'Couldn’t save that. Check your connection and try again.'}
        </Body>
      ) : null}
      {previewing ? <InvitePreview barId={barId} barName={barName} roleLevel={BARTENDER} sender={sender} welcome={text} /> : null}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: space.xs, gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  text: { flex: 1, gap: 2, minWidth: 0 },
  footer: { gap: space.sm },
});
