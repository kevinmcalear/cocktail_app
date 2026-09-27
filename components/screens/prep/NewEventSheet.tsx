import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field, PressableScale, Title, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useCreateEvent, type VenueEvent } from '@/hooks/useEvents';

interface MenuOption {
  id: string;
  name: string;
}

interface NewEventSheetProps {
  visible: boolean;
  onClose: () => void;
  barId: string;
  menus: MenuOption[];
  onCreated: (event: VenueEvent) => void;
}

function tomorrowAt7(): { date: string; time: string } {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: '19:00' };
}

/**
 * A takeover or private event: a name, when it starts, how many guests, and
 * which menu. Guest venues and guest staff come with the takeover builder.
 */
export function NewEventSheet({ visible, onClose, barId, menus, onCreated }: NewEventSheetProps) {
  const ds = useDs();
  const create = useCreateEvent();
  const defaults = tomorrowAt7();
  const [name, setName] = useState('');
  const [date, setDate] = useState(defaults.date);
  const [time, setTime] = useState(defaults.time);
  const [covers, setCovers] = useState('');
  const [menuId, setMenuId] = useState<string | null>(menus[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);

  const startsAt = new Date(`${date}T${time}`);
  const coversNumber = covers.trim() ? Number(covers) : null;
  const problem = !name.trim()
    ? 'Give the event a name.'
    : Number.isNaN(startsAt.getTime())
      ? 'Use a date like 2026-10-03 and a time like 19:00.'
      : coversNumber !== null && (!Number.isInteger(coversNumber) || coversNumber < 0)
        ? 'Guests should be a whole number.'
        : null;

  const submit = async () => {
    if (problem) return setError(problem);
    setError(null);
    try {
      const event = await create.mutateAsync({ bar_id: barId, name: name.trim(), starts_at: startsAt.toISOString(), menu_id: menuId, covers_estimate: coversNumber });
      onCreated(event);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? `Couldn't save the event: ${e.message}` : "Couldn't save the event.");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" style={[styles.scrim, { backgroundColor: ds.c.scrim }]} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: ds.c.surface }]} onPress={(e) => e.stopPropagation()}>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Title>New event</Title>
            <Field label="Name" value={name} onChangeText={setName} placeholder="Pale Moth takeover" autoFocus />
            <View style={styles.pair}>
              <View style={styles.flex}>
                <Field label="Date" value={date} onChangeText={setDate} placeholder="2026-10-03" autoCapitalize="none" />
              </View>
              <View style={styles.flex}>
                <Field label="Starts" value={time} onChangeText={setTime} placeholder="19:00" autoCapitalize="none" />
              </View>
            </View>
            <Field label="Guests expected" value={covers} onChangeText={setCovers} placeholder="140" keyboardType="number-pad" hint="Used to scale the prep list." />
            <Caption tone="muted">Menu</Caption>
            <View role="radiogroup" accessibilityLabel="Menu" style={styles.menus}>
              {menus.length === 0 ? <Body tone="muted">No menus at this venue yet.</Body> : null}
              {menus.map((m) => {
                const selected = m.id === menuId;
                return (
                  <PressableScale
                    key={m.id}
                    role="radio"
                    aria-selected={selected}
                    accessibilityLabel={m.name}
                    onPress={() => setMenuId(m.id)}
                    style={[styles.menu, { backgroundColor: selected ? ds.c.ink : ds.c.raised }]}
                  >
                    <Caption color={selected ? ds.c.ground : ds.c.ink}>{m.name}</Caption>
                  </PressableScale>
                );
              })}
            </View>
            {error ? <Caption tone="accent">{error}</Caption> : null}
            <View style={styles.actions}>
              <Button label="Cancel" variant="ghost" onPress={onClose} />
              <Button label={create.isPending ? 'Saving…' : 'Create event'} onPress={submit} disabled={create.isPending} />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '90%', borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet },
  body: { padding: space.xl, paddingBottom: space.xxxl, gap: space.md },
  pair: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
  menus: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  menu: { minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, marginTop: space.sm },
});
