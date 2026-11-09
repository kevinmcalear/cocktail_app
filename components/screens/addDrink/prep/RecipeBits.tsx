import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Caption, useDs } from '@/components/ds';
import { font, radius, space, type } from '@/constants/tokens';

/** A small number field (parts, or a line's own amount). */
export function NumberField({ label, value, onChange, suffix, placeholder }: { label: string; value: string; onChange: (v: number) => void; suffix?: string; placeholder?: string }) {
  const ds = useDs();
  const [text, setText] = useState<string | null>(null);
  return (
    <View style={[styles.box, { backgroundColor: ds.c.raised }]}>
      <TextInput
        aria-label={label}
        value={text ?? value}
        placeholder={placeholder}
        placeholderTextColor={ds.c.muted}
        keyboardType="decimal-pad"
        onChangeText={(t) => {
          setText(t);
          const v = parseFloat(t.replace(',', '.'));
          if (!Number.isNaN(v)) onChange(v);
          else if (!t.trim()) onChange(0);
        }}
        onBlur={() => setText(null)}
        style={[styles.input, type.spec, { ...font.figures, color: ds.c.ink }]}
      />
      {suffix ? <Caption tone="muted" style={styles.suffix}>{suffix}</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill, minHeight: 40, paddingHorizontal: space.xs },
  input: { minWidth: 56, maxWidth: 80, textAlign: 'center', paddingVertical: space.xs },
  suffix: { paddingRight: space.sm },
});
