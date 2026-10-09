import { useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View, type TextInput } from 'react-native';

import { Body, Button, Caption, DateField, Field, PressableScale, sheetFrame, TimeField, Title, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useCreateEvent, type VenueEvent } from '@/hooks/useEvents';
import { toDay } from '@/lib/collection';
import { focusInModal, MODAL_AUTOFOCUS } from '@/lib/modalAutoFocus';

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

function tomorrowAt7(): { today: string; date: string; time: string } {
  const d = new Date();
  return { today: toDay(d), date: toDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)), time: '19:00' };
}

/**
 * A takeover or private event: a name, when it starts, how many guests, and
 * which menu. Guest venues and guest staff come with the takeover builder.
 */
export function NewEventSheet({ visible, onClose, barId, menus, onCreated }: NewEventSheetProps) {
  const ds = useDs();
  const create = useCreateEvent();
  const [defaults] = useState(tomorrowAt7);
  const { today } = defaults;
  const [name, setName] = useState('');
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);
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
      ? 'Pick a start time.'
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onShow={MODAL_AUTOFOCUS ? undefined : () => focusInModal(nameRef)}>
      <Pressable accessibilityLabel="Close" style={[styles.scrim, { backgroundColor: ds.c.scrim }]} onPress={onClose}>
        {/* Lifts the sheet over the keyboard on native (web gets no behaviour, so a plain View). */}
        <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: 'height' })} style={[styles.avoider, sheetFrame.scrim]}>
          <Pressable style={[styles.sheet, sheetFrame.panel, { borderColor: ds.c.lineStrong, backgroundColor: ds.c.surface }]} onPress={(e) => e.stopPropagation()}>
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              <Title>New event</Title>
              <Field ref={nameRef} label="Name" value={name} onChangeText={setName} placeholder="Pale Moth takeover" autoFocus={MODAL_AUTOFOCUS} />
              <DateField label="Date" value={date} onChange={setDate} min={today} />
              <TimeField label="Starts" value={time} onChange={setTime} />
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
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1 },
  avoider: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', pointerEvents: 'box-none' },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '90%', borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet },
  body: { padding: space.xl, paddingBottom: space.xxxl, gap: space.md },
  menus: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  menu: { minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, marginTop: space.sm },
});
