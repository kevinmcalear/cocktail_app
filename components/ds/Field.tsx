import type { ComponentRef, ReactNode, Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';

import { IconSymbol } from '@/components/ui/icon-symbol';

import type { IconName } from './Button';
import { PressableScale } from './PressableScale';
import { Caption } from './Text';
import { useDs } from './theme';

interface FieldProps extends Omit<TextInputProps, 'style' | 'ref'> {
  ref?: Ref<ComponentRef<typeof TextInput>>;
  label: string;
  /** Keeps the label for screen readers only, for a search box whose placeholder says what it is. */
  hideLabel?: boolean;
  /** Shown under the field; errors say what's wrong and how to fix it. */
  hint?: string;
  error?: string;
  /** A taller box, for pasting a list. */
  minLines?: number;
  /** Buttons inside the box, at its right end: a clear, a camera. Keep them 44 pt square. */
  trailing?: ReactNode;
  /** A muted icon at the box's start: the magnifier on a search. */
  icon?: IconName;
}

/** A labelled text input in the Back Bar style. */
export function Field({ label, hideLabel, hint, error, minLines, trailing, icon, ...input }: FieldProps) {
  const ds = useDs();
  const box = (
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
        trailing ? styles.withTrailing : null,
        icon ? styles.withIcon : null,
      ]}
    />
  );
  const boxed = icon ? (
    <View>
      {box}
      <View pointerEvents="none" style={styles.icon}>
        <IconSymbol name={icon} size={18} color={ds.c.muted} />
      </View>
    </View>
  ) : (
    box
  );
  return (
    <View style={styles.field}>
      {hideLabel ? null : <Caption tone="muted">{label}</Caption>}
      {trailing ? (
        <View>
          {boxed}
          <View style={styles.trailing}>{trailing}</View>
        </View>
      ) : (
        boxed
      )}
      {error ? <Caption tone="accent">{error}</Caption> : hint ? <Caption tone="muted">{hint}</Caption> : null}
    </View>
  );
}

/** A button inside a Field's box (its `trailing`): clear the search, snap a bottle. */
export function FieldButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="button" accessibilityLabel={label} onPress={onPress} style={styles.button}>
      <IconSymbol name={icon} size={icon === 'xmark.circle.fill' ? 18 : 20} color={ds.c.muted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.xs },
  input: { minHeight: layout.minTapTarget, borderRadius: radius.control, borderWidth: 1, paddingHorizontal: space.md },
  // Room for two 44 pt buttons.
  withTrailing: { paddingRight: layout.minTapTarget * 2 },
  withIcon: { paddingLeft: space.md + 18 + space.sm },
  icon: { position: 'absolute', top: 0, bottom: 0, left: space.md, justifyContent: 'center' },
  button: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  trailing: { position: 'absolute', top: 0, bottom: 0, right: 0, flexDirection: 'row', alignItems: 'center' },
});
