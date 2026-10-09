import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Body, Caption, Chip, Field, PressableScale, Spec, Surface, Tag, useDs } from '@/components/ds';
import { displayFaces, layout, radius, space, type } from '@/constants/tokens';
import { clampServes, freezingPointC } from '@/lib/batch';
import type { SpecLine } from '@/lib/spec';

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
        style={[styles.bigInput, { fontFamily: face, color: ds.c.ink }]}
      />
      <Caption tone="muted" style={styles.unit}>
        {value === 1 ? 'serve' : 'serves'}
      </Caption>
    </View>
  );
}

/** "−18 °C", with a real minus sign. */
export const celsius = (t: number) => `${t < 0 ? '\u2212' : ''}${Math.abs(Math.round(t))}\u00a0°C`;

const FREEZERS = [-12, -15, -18, -20].map((t) => ({ value: t, label: celsius(t) }));

/**
 * Will a freezer pour stay liquid? Compares where the bottle starts to freeze
 * (from its ABV, water included) with this device's freezer.
 */
export function FreezerCheck({ abv, freezerC, onFreezerC }: { abv: number; freezerC: number; onFreezerC: (c: number) => void }) {
  const at = freezingPointC(abv);
  const ok = at < freezerC - 1;
  const strength = `At ${Math.round(abv)}% ABV it starts to freeze near ${celsius(at)}.`;
  return (
    <Surface>
      <View role="status" style={styles.freezer}>
        <Tag label={ok ? 'Stays liquid' : 'Will slush'} tone={ok ? 'success' : 'warning'} />
        <Body>{ok ? `${strength} Fine in a ${celsius(freezerC)} freezer.` : `${strength} Set the freezer to about ${celsius(-12)}, or use a stronger spirit or less water.`}</Body>
        <Choice label="Your freezer" options={FREEZERS} value={freezerC} onChange={onFreezerC} />
      </View>
    </Surface>
  );
}

/** Start from the bottle you have least of: pick the line, type how much is left. */
export function StockField({ lines, line, onLine, have, onHave, unit }: { lines: SpecLine[]; line: SpecLine; onLine: (key: string) => void; have: string; onHave: (v: string) => void; unit: string }) {
  return (
    <View style={styles.stock}>
      <View role="radiogroup" accessibilityLabel="What you have least of" style={styles.chips}>
        {lines.map((l) => (
          <Chip key={l.key} label={l.ingredient ?? ''} selected={l.key === line.key} onPress={() => onLine(l.key)} />
        ))}
      </View>
      <Field label={`How much ${line.ingredient} you have, in ${unit}`} value={have} onChangeText={onHave} keyboardType="decimal-pad" placeholder="0" />
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
  choice: { flexDirection: 'row', alignSelf: 'flex-start', borderWidth: 1, borderRadius: radius.pill, padding: 2 },
  option: { minHeight: layout.minTapTarget, minWidth: layout.minTapTarget, paddingHorizontal: space.md, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  // flex-end, not baseline: iOS doesn't baseline-align a TextInput.
  big: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  // Room above the glyphs: a serif this size overshoots a lineHeight of 1.
  bigInput: { fontSize: BIG, lineHeight: BIG * 1.15, letterSpacing: -2, width: BIG, padding: 0 },
  unit: { paddingBottom: space.xl },
  freezer: { gap: space.sm, alignItems: 'flex-start' },
  stock: { gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
