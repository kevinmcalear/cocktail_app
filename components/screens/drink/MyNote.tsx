import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field, TextLink } from '@/components/ds';
import { space } from '@/constants/tokens';
import { usePrivateNote, useSavePrivateNote } from '@/hooks/usePrivateNote';

import { MenuSheet } from '../menus/MenuSheet';

/**
 * Your own note on a drink (the add-drink wizard's "Just me"): shown to you
 * alone, under the spec, with Edit to change or remove it. Nothing when you
 * have none.
 */
export function MyNote({ itemId, name }: { itemId: string; name: string }) {
  const { data: note } = usePrivateNote(itemId);
  const [editing, setEditing] = useState(false);
  if (!note) return null;
  return (
    <View style={styles.block}>
      <Caption tone="muted">Your note · only you see it</Caption>
      <Body>{note.body}</Body>
      <TextLink label="Edit your note" onPress={() => setEditing(true)} />
      {editing ? <MyNoteSheet itemId={itemId} name={name} body={note.body} onClose={() => setEditing(false)} /> : null}
    </View>
  );
}

function MyNoteSheet({ itemId, name, body, onClose }: { itemId: string; name: string; body: string; onClose: () => void }) {
  const save = useSavePrivateNote(itemId);
  const [text, setText] = useState(body);
  const done = (value: string) => save.mutateAsync(value).then(onClose, () => {});
  return (
    <MenuSheet
      visible
      onClose={onClose}
      title="Your note"
      subtitle={name}
      footer={
        <View style={styles.footer}>
          {save.error ? <Caption tone="accent">{save.error.message}</Caption> : null}
          <Button label={save.isPending ? 'Saving…' : 'Save'} size="lg" disabled={save.isPending} onPress={() => done(text)} />
          <Button label="Remove the note" variant="ghost" disabled={save.isPending} onPress={() => done('')} />
        </View>
      }
    >
      <Field label="Your note" hideLabel value={text} onChangeText={setText} minLines={3} maxLength={2000} hint="Only you see this. It’s never shared, published or shown to a venue." />
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.xs },
  footer: { gap: space.sm },
});
