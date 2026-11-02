import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Chip, Field, GlassButton, Sheet, SheetScrollView, Title, useToast } from '@/components/ds';
import { space } from '@/constants/tokens';
import type { HandoverWrite } from '@/hooks/barWrites';
import type { useHandover } from '@/hooks/useHandover';
import { useAddHandoverPhoto } from '@/hooks/useHandoverPhoto';
import { names, ranOutChoices } from '@/lib/handover';

import { HandoverMessage, HandoverPhoto } from './HandoverNote';
import { TonightLabel } from './TonightParts';

type Handover = ReturnType<typeof useHandover>;
type Words = NonNullable<HandoverWrite['words']>;

/**
 * Leave the handover (Loop-handover, "Leave it, at close"): what ran out (tap
 * what's listed, or write anything else), what to prep, anything broken,
 * with a photo. One
 * note per close: a second closer's part adds to the first's. It sends with
 * no signal later, like the bar's other writes.
 * Mounted when opened, so it starts from what you left last time.
 * A photo of what's broken uploads when picked (it needs signal), into the
 * private handover bucket.
 */
export function HandoverWriteSheet({ h, barId, closeDate, night, houseMade, onLeave, onClose }: { h: Handover; barId: string; closeDate: string; night: string; houseMade: readonly string[]; onLeave: (words: Words) => void; onClose: () => void }) {
  const others = h.rows.filter((r) => r.close_date === closeDate && r.written_at && r.user_id !== h.me).sort((a, b) => a.written_at!.localeCompare(b.written_at!));
  const own = h.rows.find((r) => r.close_date === closeDate && r.user_id === h.me && r.written_at);
  const [picked, setPicked] = useState<string[]>(own?.ran_out ?? []);
  const [note, setNote] = useState(own?.note ?? '');
  const [prep, setPrep] = useState(own?.prep ?? '');
  const [broken, setBroken] = useState(own?.broken ?? '');
  const [photo, setPhoto] = useState<string | null>(own?.broken_photo ?? null);
  const addPhoto = useAddHandoverPhoto(barId);
  const toast = useToast();
  const pickPhoto = (): void =>
    addPhoto.mutate(undefined, {
      onSuccess: (path) => path && setPhoto(path),
      onError: (e) => toast.show({ title: 'The photo didn’t upload', detail: e.message, tone: 'error', action: { label: 'Try again', onPress: pickPhoto } }),
    });
  const lately = h.rows.filter((r) => r.close_date !== closeDate).flatMap((r) => r.ran_out);
  const choices = ranOutChoices(houseMade, lately, picked);
  const empty = !picked.length && !note.trim() && !prep.trim() && !broken.trim() && !photo;
  const toggle = (name: string) => setPicked((list) => (list.includes(name) ? list.filter((n) => n !== name) : [...list, name]));
  const clean = (text: string) => text.trim() || null;

  const leave = () => {
    onLeave({ ranOut: picked, note: clean(note), prep: clean(prep), broken: clean(broken), brokenPhoto: photo, writtenAt: new Date().toISOString() });
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
      style={styles.sheet}
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
            {photo ? (
              <View style={styles.photo}>
                <HandoverPhoto path={photo} />
                <Button label="Remove the photo" size="sm" variant="secondary" onPress={() => setPhoto(null)} />
              </View>
            ) : (
              <View style={styles.photoAct}>
                <Button label={addPhoto.isPending ? 'Adding the photo…' : 'Add a photo'} size="sm" variant="secondary" disabled={addPhoto.isPending} onPress={pickPhoto} />
              </View>
            )}
          </View>
        </View>
      </SheetScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  // The phone gutter on every platform: the Sheet itself brings no inset.
  sheet: { paddingHorizontal: space.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  form: { gap: space.xl, paddingBottom: space.xxl },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  photo: { gap: space.sm, alignItems: 'flex-start' },
  photoAct: { flexDirection: 'row' },
  flex: { flex: 1, minWidth: 0 },
});
