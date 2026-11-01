import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Chip, Field, GlassButton, Sheet, SheetScrollView, Title } from '@/components/ds';
import { space } from '@/constants/tokens';
import type { HandoverWrite } from '@/hooks/barWrites';
import type { useHandover } from '@/hooks/useHandover';
import { names, ranOutChoices } from '@/lib/handover';

import { HandoverMessage } from './Handover';
import { TonightLabel } from './TonightParts';

type Handover = ReturnType<typeof useHandover>;
type Words = NonNullable<HandoverWrite['words']>;

/**
 * Leave the handover (Loop-handover, "Leave it, at close"): what ran out (tap
 * what's listed, or write anything else), what to prep, anything broken. One
 * note per close: a second closer's part adds to the first's. It sends with
 * no signal later, like the bar's other writes.
 * Mounted when opened, so it starts from what you left last time.
 * ponytail: no photo of what's broken yet; a picture needs a place to store
 * it that the bar's people can read (a storage policy, Kevin's to approve).
 */
export function HandoverWriteSheet({ h, closeDate, night, houseMade, onLeave, onClose }: { h: Handover; closeDate: string; night: string; houseMade: readonly string[]; onLeave: (words: Words) => void; onClose: () => void }) {
  const others = h.rows.filter((r) => r.close_date === closeDate && r.written_at && r.user_id !== h.me).sort((a, b) => a.written_at!.localeCompare(b.written_at!));
  const own = h.rows.find((r) => r.close_date === closeDate && r.user_id === h.me && r.written_at);
  const [picked, setPicked] = useState<string[]>(own?.ran_out ?? []);
  const [note, setNote] = useState(own?.note ?? '');
  const [prep, setPrep] = useState(own?.prep ?? '');
  const [broken, setBroken] = useState(own?.broken ?? '');
  const lately = h.rows.filter((r) => r.close_date !== closeDate).flatMap((r) => r.ran_out);
  const choices = ranOutChoices(houseMade, lately, picked);
  const empty = !picked.length && !note.trim() && !prep.trim() && !broken.trim();
  const toggle = (name: string) => setPicked((list) => (list.includes(name) ? list.filter((n) => n !== name) : [...list, name]));
  const clean = (text: string) => text.trim() || null;

  const leave = () => {
    onLeave({ ranOut: picked, note: clean(note), prep: clean(prep), broken: clean(broken), writtenAt: new Date().toISOString() });
    onClose();
  };

  const firstNames = names(others.map((r) => h.nameOf(r.user_id).split(' ')[0]));
  return (
    <Sheet
      visible
      onClose={onClose}
      accessibilityLabel="Handover"
      kind="flow"
      keyboard
      header={
        <View style={styles.head}>
          <GlassButton accessibilityLabel="Close" icon="xmark" onPress={onClose} />
          <Title role="heading" align="center" style={styles.flex}>
            Handover
          </Title>
          <Button label="Leave it" size="sm" disabled={empty} onPress={leave} />
        </View>
      }
    >
      <SheetScrollView>
        <View style={styles.form}>
          {others.length ? (
            <View style={styles.group}>
              {others.map((r) => (
                <HandoverMessage key={r.user_id} row={r} name={h.nameOf(r.user_id)} />
              ))}
              <Body tone="muted">{`One note per close. Yours adds to ${firstNames}’s.`}</Body>
            </View>
          ) : (
            <Body tone="muted">{`For whoever opens ${night}. It sits on top of Tonight until they’ve read it.`}</Body>
          )}
          <View style={styles.group}>
            <TonightLabel title="What ran out" />
            {choices.length ? (
              <View role="group" aria-label="What ran out" style={styles.chips}>
                {choices.map((c) => (
                  <Chip key={c} quiet multi label={c} selected={picked.includes(c)} onPress={() => toggle(c)} />
                ))}
              </View>
            ) : null}
            <Field label="Anything else" hideLabel placeholder="Anything else" value={note} onChangeText={setNote} multiline maxLength={1000} />
          </View>
          <View style={styles.group}>
            <TonightLabel title="What to prep" />
            <Field label="What to prep" hideLabel placeholder="Honey-ginger syrup, one batch" value={prep} onChangeText={setPrep} multiline maxLength={1000} hint="One thing a line." />
          </View>
          <View style={styles.group}>
            <TonightLabel title="Anything broken" />
            <Field label="Anything broken" hideLabel placeholder="Ice well drains slowly" value={broken} onChangeText={setBroken} multiline maxLength={1000} />
          </View>
        </View>
      </SheetScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  form: { gap: space.xl, paddingBottom: space.xxl },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
});
