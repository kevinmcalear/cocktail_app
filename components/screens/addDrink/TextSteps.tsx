import { StyleSheet, TextInput, View } from 'react-native';

import { Button, Caption, Field, useDs } from '@/components/ds';
import { displayFaces, radius, space, type } from '@/constants/tokens';
import type { StepProps } from '@/lib/drinkWizard';
import { capitalizeAsYouType } from '@/lib/stringUtils';

/** The drink's name, big, in the venue's display face. Return moves on. */
export function NameStep({ draft, set, onDone, resumed, onStartOver }: StepProps & { onDone: () => void; resumed: boolean; onStartOver: () => void }) {
  return <BigName value={draft.name} onChange={(name) => set({ name })} onDone={onDone} resumed={resumed} onStartOver={onStartOver} />;
}

/** A wizard's first step: the name, big, in the venue's display face, with "Start over" for a kept draft. */
export function BigName({ value, onChange, onDone, resumed, onStartOver, placeholder = 'Name' }: { value: string; onChange: (name: string) => void; onDone: () => void; resumed: boolean; onStartOver: () => void; placeholder?: string }) {
  const ds = useDs();
  return (
    <View style={styles.stack}>
      <TextInput
        value={value}
        onChangeText={(name) => onChange(capitalizeAsYouType(name))}
        onSubmitEditing={onDone}
        returnKeyType="next"
        autoFocus={!value}
        placeholder={placeholder}
        placeholderTextColor={ds.c.faint}
        aria-label="Name"
        maxLength={80}
        style={[styles.name, type.title, { fontFamily: displayFaces[ds.displayFace].regular, color: ds.c.ink, borderBottomColor: ds.c.lineStrong }]}
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

/** The menu line guests read, and notes for whoever makes it next. */
export function NotesStep({ draft, set }: StepProps) {
  return (
    <View style={styles.stack}>
      <Field
        label="On the menu"
        hint="A line or two a guest reads."
        value={draft.description}
        onChangeText={(description) => set({ description })}
        minLines={2}
        maxLength={500}
      />
      <Field
        label="Notes"
        hint="Anything the next person to make it should know."
        value={draft.notes}
        onChangeText={(notes) => set({ notes })}
        minLines={3}
        maxLength={2000}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  resumed: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm },
  name: { minHeight: 56, borderBottomWidth: 1, paddingVertical: space.sm, borderRadius: radius.mark },
});
