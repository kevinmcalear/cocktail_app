import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Body, Caption, PressableScale, Spec, Tag, useDs } from '@/components/ds';
import { displayFaces, layout, radius, space, type } from '@/constants/tokens';
import { clampServes } from '@/lib/batch';

/** One line of the batch: the ingredient (and why it's left out) with the amount on the right. */
export function BatchRow({ ingredient, amount, sub, tag }: { ingredient: string; amount: string; sub?: string | null; tag?: string | null }) {
  const ds = useDs();
  const spoken = [amount, ingredient, sub, tag && `${tag}, not in the bottle`].filter(Boolean).join(', ');
  return (
    <View accessible accessibilityLabel={spoken} style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <View style={styles.name}>
        <Body tone={tag ? 'muted' : 'ink'}>{ingredient}</Body>
        {sub ? <Caption tone="muted">{sub}</Caption> : null}
        {tag ? <Tag label={tag} tone="accent" /> : null}
      </View>
      <Spec tone={tag ? 'muted' : 'ink'} align="right">
        {amount}
      </Spec>
    </View>
  );
}

/** A small single-choice group (ml or oz, 750 ml or 1 L bottles). */
export function Choice<T extends string | number>({ label, options, value, onChange }: { label: string; options: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const ds = useDs();
  return (
    <View role="radiogroup" accessibilityLabel={label} style={[styles.choice, { borderColor: ds.c.lineStrong }]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <PressableScale
            key={String(o.value)}
            role="radio"
            aria-checked={selected}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            style={[styles.option, { backgroundColor: selected ? ds.c.ink : 'transparent' }]}
          >
            <Caption color={selected ? ds.c.ground : ds.c.muted}>{o.label}</Caption>
          </PressableScale>
        );
      })}
    </View>
  );
}

/**
 * The big serve count, which is also a text field: tap it and type, as the
 * fallback to dragging. Commits whole serves as you type, clamped on blur.
 */
export function ServesField({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const ds = useDs();
  const [draft, setDraft] = useState<string | null>(null);
  const face = displayFaces[ds.displayFace].regular;
  return (
    <View style={styles.big}>
      <TextInput
        value={draft ?? String(value)}
        onChangeText={(t) => {
          const digits = t.replace(/\D/g, '').slice(0, 2);
          setDraft(digits);
          if (digits) onChange(clampServes(Number(digits)));
        }}
        onFocus={() => setDraft(String(value))}
        onBlur={() => setDraft(null)}
        onSubmitEditing={() => setDraft(null)}
        keyboardType="number-pad"
        returnKeyType="done"
        selectTextOnFocus
        maxLength={2}
        accessibilityLabel="Serves"
        accessibilityHint="Type a number of serves"
        style={[styles.bigInput, { fontFamily: face, color: ds.c.ink, borderBottomColor: ds.c.line }]}
      />
      <Caption tone="muted">{value === 1 ? 'serve' : 'serves'}</Caption>
    </View>
  );
}

const BIG = type.display.fontSize * 1.6;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: { flex: 1, gap: space.xs },
  choice: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.pill, padding: 2 },
  option: { minHeight: layout.minTapTarget, minWidth: layout.minTapTarget, paddingHorizontal: space.md, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  big: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  bigInput: {
    fontSize: BIG,
    lineHeight: BIG,
    letterSpacing: -2,
    minWidth: BIG * 1.2,
    padding: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
