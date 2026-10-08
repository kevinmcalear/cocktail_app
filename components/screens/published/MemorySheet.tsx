import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DateField, Field } from '@/components/ds';
import { Choice, MenuSheet } from '@/components/screens/menus/MenuSheet';
import { space } from '@/constants/tokens';
import { useUpdateMemory, type CollectedDrink } from '@/hooks/useCollection';
import { parseDay, toDay } from '@/lib/collection';

const NOTE_LIMIT = 1000;

/**
 * Your part of a collected drink: when you had it and a note ("birthday, the
 * one with the smoke"). The name, bar and picture stay as they were collected.
 */
export function MemorySheet({ memory, onClose }: { memory: CollectedDrink; onClose: () => void }) {
  const [date, setDate] = useState(memory.hadOn ?? '');
  const [note, setNote] = useState(memory.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const save = useUpdateMemory();
  const [{ today, yesterday }] = useState(() => {
    const now = new Date();
    return { today: toDay(now), yesterday: toDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)) };
  });

  const submit = async () => {
    const hadOn = date.trim() ? parseDay(date) : null;
    if (date.trim() && !hadOn) return setError('Pick a day.');
    if (hadOn && hadOn > today) return setError('That day hasn’t happened yet.');
    setError(null);
    try {
      await save.mutateAsync({ id: memory.id, hadOn, note: note.trim() || null });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t save that. Try again.');
    }
  };

  return (
    <MenuSheet
      visible
      onClose={onClose}
      title={memory.name}
      subtitle={memory.barName ?? undefined}
      footer={<Button label={save.isPending ? 'Saving…' : 'Save'} size="lg" onPress={submit} disabled={save.isPending} />}
    >
      <Caption tone="muted">When you had it</Caption>
      <View role="radiogroup" accessibilityLabel="When you had it" style={styles.wrap}>
        <Choice label="Tonight" selected={date === today} onPress={() => setDate(today)} />
        <Choice label="Last night" selected={date === yesterday} onPress={() => setDate(yesterday)} />
      </View>
      <DateField label="Date" value={date} onChange={setDate} max={today} clearable placeholder="Don’t remember" hint="Leave it blank if you don’t remember." />
      <Field
        label="Note"
        value={note}
        onChangeText={(t) => setNote(t.slice(0, NOTE_LIMIT))}
        placeholder="Who you were with, what it tasted like"
        multiline
        hint={note.length > NOTE_LIMIT - 100 ? `${NOTE_LIMIT - note.length} characters left` : 'Only you see this.'}
      />
      {error ? <Body tone="accent">{error}</Body> : null}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
