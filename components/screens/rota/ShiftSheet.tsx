import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Caption, DayGrid, dragDismissesKeyboard, DsText, Field, GlassButton, PickerPanel, PressableScale, Sheet, SheetScrollView, Surface, TimeGrid, useDs, useSheetClose } from '@/components/ds';
import { RowDivider, SettingsRow, SwitchRow } from '@/components/screens/settings/SettingsParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, layout, radius, space } from '@/constants/tokens';
import type { Shift } from '@/hooks/useRota';
import { newDraftId } from '@/lib/drinkWizard';
import { clockOf, dayShort, nightOf, sheetClock, shiftMoments, type RotaChange } from '@/lib/rota';

import { PersonMark } from './RotaParts';
import type { RotaPerson } from './useRotaWeek';

/** What the sheet opens on: a shift to edit, or a night and maybe a person for a new one. */
export interface ShiftSheetOpen {
  shift?: Shift;
  night: string;
  userId?: string;
}

type Panel = 'who' | 'day' | 'start' | 'end' | null;

/** The drawn new shift: 4pm to midnight. */
const START = '16:00';
const END = '00:00';

/** X, the title, a tick to Save: the board's sheet head. Android's back is the arrow. */
function Head({ title, canSave, onSave }: { title: string; canSave: boolean; onSave: () => void }) {
  const ds = useDs();
  const close = useSheetClose();
  return (
    <View style={styles.head}>
      <GlassButton icon={Platform.OS === 'android' ? 'chevron.left' : 'xmark'} accessibilityLabel="Close" onPress={close} />
      <DsText role="heading" numberOfLines={1} style={styles.title}>
        {title}
      </DsText>
      <PressableScale
        role="button"
        accessibilityLabel="Save"
        aria-disabled={!canSave}
        disabled={!canSave}
        onPress={() => {
          onSave();
          close();
        }}
        style={[styles.save, { backgroundColor: ds.accentFill.fill, opacity: canSave ? 1 : 0.4 }]}
      >
        <IconSymbol name="checkmark" size={18} color={ds.accentFill.text} />
      </PressableScale>
    </View>
  );
}

function DeleteRow({ onDelete }: { onDelete: () => void }) {
  const close = useSheetClose();
  return (
    <Grouped>
      <SettingsRow
        role="button"
        tone="danger"
        label="Delete this shift"
        trailing={<View />}
        onPress={() => {
          onDelete();
          close();
        }}
      />
    </Grouped>
  );
}

function Grouped({ children }: { children: ReactNode }) {
  return <Surface style={styles.card}>{children}</Surface>;
}

/**
 * New and edit shift (Kept-rota): who, the night, when, who opens and closes,
 * a note. Saves on the tick; the rota shows it at once and it waits on the
 * phone with no signal (useSaveShifts).
 */
export function ShiftSheet({ open, barName, people, timeZone, onClose, onSave, onDelete }: {
  open: ShiftSheetOpen;
  barName: string;
  people: RotaPerson[];
  timeZone: string | null;
  onClose: () => void;
  onSave: (row: RotaChange['rows'][number]) => void;
  onDelete: (shift: Shift) => void;
}) {
  const ds = useDs();
  const { shift } = open;
  const [userId, setUserId] = useState(shift?.user_id ?? open.userId ?? null);
  const [night, setNight] = useState(shift ? nightOf(shift.starts_at, timeZone) : open.night);
  const [start, setStart] = useState(shift ? clockOf(shift.starts_at, timeZone) : START);
  const [end, setEnd] = useState(shift ? clockOf(shift.ends_at, timeZone) : END);
  const [opens, setOpens] = useState(shift?.opens ?? false);
  const [closes, setCloses] = useState(shift?.closes ?? false);
  const [note, setNote] = useState(shift?.note ?? '');
  const [panel, setPanel] = useState<Panel>(null);
  const person = people.find((p) => p.user_id === userId);
  const toggle = (next: Panel) => () => setPanel(panel === next ? null : next);

  const save = () => onSave({ id: shift?.id ?? newDraftId(), user_id: userId!, ...shiftMoments(night, start, end, timeZone), opens, closes, note: note.trim() || null });
  // Someone who's left can't be saved onto the rota (shifts_write checks the team): pick someone else or delete it.
  const title = !shift ? 'New shift' : person ? `${person.name.split(' ')[0]}’s shift` : 'Shift';
  return (
    <Sheet visible onClose={onClose} accessibilityLabel={title} kind="flow" keyboard header={<Head title={title} canSave={!!person && start !== end} onSave={save} />}>
      <SheetScrollView {...dragDismissesKeyboard} contentContainerStyle={styles.body}>
        <Grouped>
          <SettingsRow role="button" expanded={panel === 'who'} leading={person ? <PersonMark person={person} size={32} /> : undefined} icon="person" label={person?.name ?? 'Who'} detail={person?.role} value={person ? undefined : 'Pick from the team'} onPress={toggle('who')} />
          {panel === 'who'
            ? people.map((p) => (
                <View key={p.user_id}>
                  <RowDivider />
                  <SettingsRow
                    role="button"
                    leading={<PersonMark person={p} size={32} />}
                    label={p.name}
                    detail={p.role}
                    trailing={p.user_id === userId ? <IconSymbol name="checkmark" size={18} color={ds.accentText} /> : <View />}
                    onPress={() => {
                      setUserId(p.user_id);
                      setPanel(null);
                    }}
                  />
                </View>
              ))
            : null}
        </Grouped>
        <Grouped>
          <SettingsRow role="button" expanded={panel === 'day'} icon="calendar" label="Day" value={dayShort(night)} onPress={toggle('day')} />
          {panel === 'day' ? (
            <PickerPanel>
              <DayGrid
                value={night}
                onPick={(day) => {
                  setNight(day);
                  setPanel(null);
                }}
              />
            </PickerPanel>
          ) : null}
          <RowDivider />
          <SettingsRow role="button" expanded={panel === 'start'} icon="clock" label="Starts" value={sheetClock(start)} onPress={toggle('start')} />
          {panel === 'start' ? (
            <PickerPanel>
              <TimeGrid value={start} onChange={setStart} onPicked={() => setPanel(null)} />
            </PickerPanel>
          ) : null}
          <RowDivider />
          <SettingsRow role="button" expanded={panel === 'end'} icon="clock" label="Ends" value={sheetClock(end)} onPress={toggle('end')} />
          {panel === 'end' ? (
            <PickerPanel>
              <TimeGrid value={end} onChange={setEnd} onPicked={() => setPanel(null)} />
            </PickerPanel>
          ) : null}
        </Grouped>
        <Grouped>
          <SwitchRow label="Opens" detail="Sets up the bar before doors" value={opens} onValueChange={setOpens} />
          <RowDivider />
          <SwitchRow label="Closes" detail="Counts down and locks up" value={closes} onValueChange={setCloses} />
        </Grouped>
        <Field label="Note" hideLabel placeholder="Note, like “bar back till 8”" value={note} onChangeText={setNote} maxLength={200} />
        {shift && !person ? <Caption tone="muted">Whoever had this shift isn’t on the team now. Pick someone to keep it, or delete it.</Caption> : null}
        {shift ? <DeleteRow onDelete={() => onDelete(shift)} /> : <Caption tone="muted">{`Only people on ${barName}’s team can be on its rota. They see it on Tonight.`}</Caption>}
      </SheetScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.md },
  title: { flex: 1, textAlign: 'center', ...font.semiBold },
  save: { width: layout.minTapTarget, height: layout.minTapTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: space.lg, paddingBottom: space.xxxl, gap: space.lg },
  card: { paddingVertical: space.xs, paddingHorizontal: space.lg, overflow: 'hidden' },
});
