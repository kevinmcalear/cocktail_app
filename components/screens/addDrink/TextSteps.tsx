import { useState, type ComponentProps, type ComponentRef, type Ref } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { Button, Caption, Field, useDs } from '@/components/ds';
import { displayFaces, space, type } from '@/constants/tokens';
import { notesArePrivate, type StepProps } from '@/lib/drinkWizard';
import { capitalizeAsYouType } from '@/lib/stringUtils';

import { Eyebrow, WizardChip } from './WizardChrome';

// The underline shows focus. Chrome draws `outline-style: auto` at any width, so it's switched off (as SearchField does).
const NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

/** The drink's name, big, in the venue's display face. Return moves on. */
export function NameStep({ draft, set, onDone, resumed, onStartOver }: StepProps & { onDone: () => void; resumed: boolean; onStartOver: () => void }) {
  return <BigName value={draft.name} onChange={(name) => set({ name })} onDone={onDone} resumed={resumed} onStartOver={onStartOver} />;
}

/** A wizard's first step: the name, big, in the venue's display face, with "Start over" for a kept draft. */
export function BigName({ value, onChange, onDone, resumed, onStartOver, placeholder = 'Name', inputRef }: { value: string; onChange: (name: string) => void; onDone: () => void; resumed: boolean; onStartOver: () => void; placeholder?: string; inputRef?: Ref<ComponentRef<typeof TextInput>> }) {
  const ds = useDs();
  // The underline is the field (no box, no browser focus ring); it darkens to ink while typing.
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.stack}>
      <TextInput
        ref={inputRef}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        value={value}
        onChangeText={(name) => onChange(capitalizeAsYouType(name))}
        onSubmitEditing={onDone}
        returnKeyType="next"
        autoFocus={!value}
        placeholder={placeholder}
        placeholderTextColor={ds.c.faint}
        aria-label="Name"
        maxLength={80}
        style={[styles.name, type.title, { fontFamily: displayFaces[ds.displayFace].regular, color: ds.c.ink, borderBottomColor: focused ? ds.c.ink : ds.c.lineStrong }, NO_OUTLINE]}
      />
      {resumed ? (
        <View style={styles.resumed}>
          <Caption tone="muted">Picked up where you left off.</Caption>
          <Button label="Start over" variant="ghost" onPress={onStartOver} />
        </View>
      ) : (
        <Caption tone="muted">Only the name is needed. Everything after it can be skipped and added later.</Caption>
      )}
    </View>
  );
}

/**
 * The menu line guests read, and notes: with the drink, for whoever can see
 * it (the next step says who), or just for you. At home one box, the notes,
 * just for you to start (Q27, board w2-wizard-finish); the menu line is on
 * the drink's page.
 */
export function NotesStep({ draft, set, barId = null }: StepProps & { barId?: string | null }) {
  const mine = notesArePrivate(draft, barId);
  const justMe = <WizardChip key="me" label="Just me" selected={mine} onPress={() => set({ notesPrivate: true })} />;
  const withDrink = <WizardChip key="drink" label="With the drink" selected={!mine} onPress={() => set({ notesPrivate: false })} />;
  return (
    <View style={styles.stack}>
      {barId ? (
        <NoteBox
          label="On the menu"
          hint="A line or two a guest reads."
          value={draft.description}
          onChangeText={(description) => set({ description })}
          minLines={2}
          maxLength={500}
        />
      ) : null}
      <NoteBox
        label="Notes"
        hint={barId ? 'Anything the next person to make it should know.' : 'What to change next time, where it came from.'}
        value={draft.notes}
        onChangeText={(notes) => set({ notes })}
        minLines={3}
        maxLength={2000}
      />
      <View style={styles.section}>
        <Eyebrow>{barId ? 'Who reads the notes?' : 'Who reads them?'}</Eyebrow>
        <View role="radiogroup" accessibilityLabel="Who reads the notes" style={styles.chips}>
          {barId ? [withDrink, justMe] : [justMe, withDrink]}
        </View>
        <Caption tone="muted">
          {mine ? 'Only you see them, on the drink’s page. Never shared or published.' : 'Shown on its page to whoever can see the drink. You choose who on the next step.'}
        </Caption>
      </View>
    </View>
  );
}

/** A box with what it's for under its title, above the box (Eddie, 26 Oct: under the box it read as part of the next one). */
function NoteBox({ label, hint, ...field }: ComponentProps<typeof Field> & { hint: string }) {
  return (
    <View style={styles.box}>
      <View>
        <Caption>{label}</Caption>
        <Caption tone="muted">{hint}</Caption>
      </View>
      <Field label={label} hideLabel {...field} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.sm },
  stack: { gap: space.lg },
  section: { gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  resumed: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: space.sm },
  name: { minHeight: 56, borderBottomWidth: 1, paddingVertical: space.sm },
});
