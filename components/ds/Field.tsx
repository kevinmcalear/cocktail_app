import type { Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';

import { Caption } from './Text';
import { useDs } from './theme';

interface FieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Shown under the field; errors say what's wrong and how to fix it. */
  hint?: string;
  error?: string;
  /** A taller box, for pasting a list. */
  minLines?: number;
  ref?: Ref<TextInput>;
}

/** A labelled text input in the Back Bar style. */
export function Field({ label, hint, error, minLines, ...input }: FieldProps) {
  const ds = useDs();
  return (
    <View style={styles.field}>
      <Caption tone="muted">{label}</Caption>
      <TextInput
        {...input}
        multiline={minLines ? true : input.multiline}
        aria-label={label}
        placeholderTextColor={ds.c.faint}
        style={[
          styles.input,
          type.body,
          minLines ? { minHeight: layout.minTapTarget * minLines, paddingVertical: space.md, textAlignVertical: 'top' } : null,
          { fontFamily: fontFamilies.body, color: ds.c.ink, backgroundColor: ds.c.raised, borderColor: error ? ds.accentText : ds.c.line },
        ]}
      />
      {error ? <Caption tone="accent">{error}</Caption> : hint ? <Caption tone="muted">{hint}</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.xs },
  input: { minHeight: layout.minTapTarget, borderRadius: radius.control, borderWidth: 1, paddingHorizontal: space.md },
});
