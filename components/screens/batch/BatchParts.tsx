import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Body, Caption, Chip, Field, PressableScale, Spec, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { clampServes, freezingPointC, type Batch, type BatchLine, type VolumeUnit } from '@/lib/batch';
import type { SpecLine } from '@/lib/spec';

/**
 * One line of the batch, as drawn: the amount first in mono, then the
 * ingredient with a short note beside it ("citrus stays out"). With
 * `onToggle` it's a checklist row, for making it and ticking each line off as
 * it goes in. `sub` and `tag` are said to screen readers.
 */
export function BatchRow({ ingredient, amount, sub, tag, note, tone = 'ink', checked, onToggle }: { ingredient: string; amount: string; sub?: string | null; tag?: string | null; note?: string | null; tone?: 'ink' | 'accent' | 'muted'; checked?: boolean; onToggle?: () => void }) {
  const ds = useDs();
  const spoken = [amount, ingredient, sub, tag && `${tag}, not in the bottle`].filter(Boolean).join(', ');
  const quiet = tone === 'muted' || checked;
  const content = (
    <>
      {onToggle ? (
        <View style={[styles.tick, { borderColor: checked ? ds.accentFill.fill : ds.c.lineStrong, backgroundColor: checked ? ds.accentFill.fill : 'transparent' }]} aria-hidden>
          {checked ? <IconSymbol name="checkmark" size={14} color={ds.accentFill.text} /> : null}
        </View>
      ) : null}
      <Spec tone={quiet ? 'muted' : tone === 'accent' ? 'accent' : 'ink'} align="right" style={styles.amount}>
        {amount}
      </Spec>
      <Body tone={quiet ? 'muted' : 'ink'} style={[styles.name, checked ? styles.done : undefined]}>
        {ingredient}
        {note ? <Caption tone="muted">{` ${note}`}</Caption> : null}
      </Body>
    </>
  );
  if (onToggle) {
    return (
      <PressableScale role="checkbox" aria-checked={!!checked} accessibilityLabel={spoken} onPress={onToggle} style={[styles.row, { borderBottomColor: ds.c.line }]}>
        {content}
      </PressableScale>
    );
  }
  return (
    <View accessible accessibilityLabel={spoken} style={[styles.row, { borderBottomColor: ds.c.line }]}>
      {content}
    </View>
  );
}

/**
 * What goes in the bottle: each line (a house-made one says how long it keeps)
 * and the water, or a shaken drink's "0 ml, the shake dilutes it". Making it,
 * each is a tick.
 */
export function BottleRows({ batch, bottled, unit, houseNote, ticked, onTick }: { batch: Batch; bottled: BatchLine[]; unit: VolumeUnit; houseNote: (key: string) => string | null; ticked: string[] | null; onTick: (key: string) => void }) {
  const water = batch.water;
  const pct = water ? `${Number(water.pct.toFixed(1))}%` : '';
  const waterNote = batch.method === 'stirred' ? `${pct}, stands in for stirring` : `${pct} of the mix before water`;
  return (
    <>
      {bottled.map((l) => {
        const note = [l.sub, houseNote(l.key)].filter(Boolean).join(' · ') || null;
        return <BatchRow key={l.key} ingredient={l.ingredient} amount={l.amount} note={note} sub={note} checked={ticked?.includes(l.key)} onToggle={ticked ? () => onTick(l.key) : undefined} />;
      })}
      {water ? (
        <BatchRow ingredient="Filtered water" amount={water.amount} tone="accent" note={waterNote} sub={waterNote} checked={ticked?.includes('water')} onToggle={ticked ? () => onTick('water') : undefined} />
      ) : batch.method === 'shaken' ? (
        <BatchRow ingredient="Water" amount={unit === 'oz' ? '0 oz' : '0 ml'} tone="muted" note="the shake dilutes it" sub="the shake dilutes it" />
      ) : null}
    </>
  );
}

/** Bottle sizes as three equal tiles, the picked one outlined in the accent (board drink-sheet-batch-home). */
export function BottleTiles<T extends number>({ options, value, onChange }: { options: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const ds = useDs();
  return (
    <View role="radiogroup" accessibilityLabel="Bottle size" style={styles.tiles}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <PressableScale
            key={o.value}
            role="radio"
            aria-checked={on}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            style={[styles.tile, { borderColor: on ? ds.accentText : ds.c.lineStrong, backgroundColor: on ? withAlpha(ds.accentText, 0.12) : 'transparent' }]}
          >
            <Spec>{o.label}</Spec>
          </PressableScale>
        );
      })}
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
export function ServesField({ value, onChange, detail, trailing }: { value: number; onChange: (v: number) => void; detail?: string | null; trailing?: ReactNode }) {
  const ds = useDs();
  const [draft, setDraft] = useState<string | null>(null);
  const face = displayFaces[ds.displayFace].regular;
  const shown = draft ?? String(value);
  // Two digits at full size; three and four shrink to the display size so the row keeps its room.
  const size = BIG * Math.min(1, 2.5 / Math.max(2, shown.length));
  const font = { fontFamily: face, fontSize: size, lineHeight: size * 1.15 };
  return (
    <View style={styles.big}>
      {/* The hidden copy sizes the box to the face's real digits (some faces run wider than half an em); the field fills it. */}
      <View style={{ minWidth: size }}>
        <Text aria-hidden style={[styles.bigInput, styles.ghost, font]}>
          {shown}
        </Text>
        <TextInput
          value={shown}
          onChangeText={(t) => {
            const digits = t.replace(/\D/g, '').slice(0, 4);
            setDraft(digits);
            if (digits) onChange(clampServes(Number(digits)));
          }}
          onFocus={() => setDraft(String(value))}
          onBlur={() => setDraft(null)}
          onSubmitEditing={() => setDraft(null)}
          keyboardType="number-pad"
          returnKeyType="done"
          selectTextOnFocus
          maxLength={4}
          accessibilityLabel="Serves"
          accessibilityHint="Type a number of serves"
          style={[styles.bigInput, StyleSheet.absoluteFill, font, { color: ds.c.ink }]}
        />
      </View>
      {/* "serves · fills 1 × 1 L" beside the count, the units at the end of the row (board drink-sheet-batch-venue). */}
      <Body tone="muted" style={[styles.unit, styles.detail]}>
        {[value === 1 ? 'serve' : 'serves', detail].filter(Boolean).join(' · ')}
      </Body>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
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
  const ds = useDs();
  const [changing, setChanging] = useState(false);
  const at = freezingPointC(abv);
  const ok = at < freezerC - 1;
  const strength = `At ${Math.round(abv)}% ABV it starts to freeze near ${celsius(at)}.`;
  const tint = ok ? ds.c.lineStrong : withAlpha(ds.accentText, 0.4);
  return (
    <View role="status" style={[styles.freezer, { borderColor: tint, backgroundColor: ok ? ds.c.surface : withAlpha(ds.accentText, 0.1) }]}>
      <View style={styles.freezerHead}>
        <IconSymbol name="snowflake" size={16} color={ok ? ds.c.ink : ds.accentText} />
        <Body color={ok ? ds.c.ink : ds.accentText} style={styles.strong}>
          {ok ? `Stays liquid in a ${celsius(freezerC)} freezer` : `Will slush in a ${celsius(freezerC)} freezer`}
        </Body>
      </View>
      <Body>{ok ? strength : `${strength} Set the freezer to about ${celsius(-12)}, or use a stronger spirit or less water.`}</Body>
      <PressableScale role="button" aria-expanded={changing} accessibilityLabel={`Your freezer: ${celsius(freezerC)}. Change`} onPress={() => setChanging((c) => !c)} style={styles.change}>
        <Caption tone="muted" style={styles.underline}>{`Your freezer: ${celsius(freezerC)} · change`}</Caption>
      </PressableScale>
      {changing ? <Choice label="Your freezer" options={FREEZERS} value={freezerC} onChange={onFreezerC} /> : null}
    </View>
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
const AMOUNT_W = 88;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  amount: { width: AMOUNT_W },
  name: { flex: 1, minWidth: 0 },
  tick: { width: 22, height: 22, borderRadius: radius.mark, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  done: { textDecorationLine: 'line-through' },
  choice: { flexDirection: 'row', alignSelf: 'flex-start', borderWidth: 1, borderRadius: radius.pill, padding: 2 },
  option: { minHeight: layout.minTapTarget, minWidth: layout.minTapTarget, paddingHorizontal: space.md, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  tiles: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, minHeight: layout.minTapTarget + space.xs, alignItems: 'center', justifyContent: 'center', borderRadius: radius.control, borderWidth: 1 },
  // flex-end, not baseline: iOS doesn't baseline-align a TextInput.
  big: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  // Room above the glyphs: a serif this size overshoots a lineHeight of 1.
  bigInput: { letterSpacing: -2, padding: 0 },
  // A little room past the last digit for the cursor.
  ghost: { opacity: 0, paddingRight: space.xs },
  unit: { flex: 1, paddingBottom: space.xl },
  trailing: { paddingBottom: space.lg },
  detail: { fontSize: type.body.fontSize - 2, lineHeight: type.body.lineHeight - 2 },
  freezer: { gap: space.sm, alignItems: 'flex-start', padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1 },
  freezerHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  change: { minHeight: space.xl, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
  stock: { gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
