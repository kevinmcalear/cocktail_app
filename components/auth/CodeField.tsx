import { Fragment, useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { DsText, useDs } from '@/components/ds';
import { STATUS } from '@/constants/palette';
import { fontFamilies, radius, space, type } from '@/constants/tokens';
import { CODE_LENGTH, cleanCode } from '@/lib/authCode';
import { readableAccent } from '@/lib/color';

/**
 * The emailed code, one box per digit. A single real input sits over the
 * boxes, so typing, pasting and the keyboard's "From Mail" suggestion all
 * fill it at once.
 */
export function CodeField({
  value,
  onChangeText,
  invalid,
  disabled,
}: {
  value: string;
  onChangeText: (code: string) => void;
  /** The last try didn't match: the boxes say so too (the message says how to fix it). */
  invalid?: boolean;
  disabled?: boolean;
}) {
  const ds = useDs();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);
  const digits = Array.from({ length: CODE_LENGTH }, (_, i) => value[i] ?? '');
  const current = Math.min(value.length, CODE_LENGTH - 1);
  // A wrong code turns every box the status red (canvas make-onboarding-signin-code-wrong).
  const wrong = readableAccent(STATUS.danger, ds.c.ground);
  const half = Math.floor(CODE_LENGTH / 2);

  return (
    <Pressable onPress={() => input.current?.focus()} style={styles.row} accessible={false}>
      {digits.map((digit, i) => {
        const active = focused && i === current;
        const border = invalid ? wrong : active ? ds.accentText : ds.c.lineStrong;
        return (
          <Fragment key={i}>
            {/* "482 – 913": a dash between the halves, as the email sets the code. */}
            {i === half ? <View aria-hidden style={[styles.dash, { backgroundColor: ds.c.lineStrong }]} /> : null}
            <View aria-hidden style={[styles.cell, { backgroundColor: ds.c.surface, borderColor: border, borderWidth: active || invalid ? 2 : 1 }]}>
              <DsText style={styles.digit}>{digit}</DsText>
            </View>
          </Fragment>
        );
      })}
      <TextInput
        ref={input}
        value={value}
        onChangeText={(text) => onChangeText(cleanCode(text))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={!disabled}
        autoFocus
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        caretHidden
        aria-label={`${CODE_LENGTH}-digit code from the email`}
        aria-invalid={invalid}
        selectionColor="transparent"
        style={[StyleSheet.absoluteFill, styles.input]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  cell: { flex: 1, height: 60, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  dash: { width: space.sm, height: 2, alignSelf: 'center' },
  digit: { ...type.headline, fontFamily: fontFamilies.monoMedium, fontVariant: ['tabular-nums'] },
  // Invisible but still focusable and fillable (opacity 0 stops some autofill).
  input: { color: 'transparent', backgroundColor: 'transparent', borderWidth: 0, opacity: 0.02 },
});
