import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Caption, useDs } from '@/components/ds';
import { fontFamilies, radius, space, type } from '@/constants/tokens';
import type { PrepDraft } from '@/lib/prepKinds';
import { prepShares } from '@/lib/prepShares';

/** Each line's share of the recipe as one segmented bar, in the colours it's drawn in. */
export function Shares({ draft }: { draft: PrepDraft }) {
  const shares = prepShares(draft);
  if (shares.length < 2) return null;
  return (
    <View aria-label={`In it: ${shares.map((s) => `${s.name} ${Math.round(s.share * 100)}%`).join(', ')}`} style={styles.shares}>
      {shares.map((s) => (
        <View key={s.key} style={[styles.share, { flexGrow: s.share, backgroundColor: s.hex }]} />
      ))}
    </View>
  );
}

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
        style={[styles.input, type.spec, { fontFamily: fontFamilies.mono, color: ds.c.ink }]}
      />
      {suffix ? <Caption tone="muted" style={styles.suffix}>{suffix}</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shares: { flexDirection: 'row', gap: 2, height: space.sm, borderRadius: radius.mark, overflow: 'hidden' },
  share: { flexBasis: 0 },
  box: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill, minHeight: 40, paddingHorizontal: space.xs },
  input: { minWidth: 56, maxWidth: 80, textAlign: 'center', paddingVertical: space.xs },
  suffix: { paddingRight: space.sm },
});
