import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Body, Caption, IngredientThumb, PressableScale, Spec, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Choice } from '@/components/screens/batch/BatchParts';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import type { IngredientAlias } from '@/lib/ingredientNames';
import { partsText, prepAmounts, prepYield, type PrepDraft, type PrepDraftLine } from '@/lib/prepKinds';
import { formatQuantity, toQuantity } from '@/lib/quantity';

import { IngredientSearch, type CatalogIngredient } from '../IngredientSearch';

interface PrepRecipeStepProps {
  draft: PrepDraft;
  set: (change: Partial<PrepDraft>) => void;
  ingredients: readonly CatalogIngredient[];
  aliases?: readonly IngredientAlias[];
}

const VIEWS = [
  { value: 'parts', label: 'Parts' },
  { value: 'amounts', label: 'Amounts' },
] as const;
const UNITS = ['g', 'ml', 'each', ''] as const;

/**
 * New prep, the recipe: parts of one base line, which carries the amount
 * (step it up or down and the rest follows). Lines can be swapped, removed
 * or added; a line with its own amount (2 chilies) stays as typed.
 */
export function PrepRecipeStep({ draft, set, ingredients, aliases }: PrepRecipeStepProps) {
  const ds = useDs();
  const [view, setView] = useState<'parts' | 'amounts'>('parts');
  const [swapKey, setSwapKey] = useState<string | null>(null);
  const amounts = prepAmounts(draft);
  const base = draft.lines.find((l) => l.key === draft.baseKey);
  const makes = prepYield(draft);
  const change = (key: string, c: Partial<PrepDraftLine>) => set({ lines: draft.lines.map((l) => (l.key === key ? { ...l, ...c } : l)) });
  const remove = (l: PrepDraftLine) => {
    const lines = draft.lines.filter((x) => x.key !== l.key);
    // Taking out the base hands it to the next line with parts.
    const nextBase = l.key === draft.baseKey ? lines.find((x) => x.parts !== null) : null;
    set({ lines, ...(nextBase ? { baseKey: nextBase.key, baseAmount: Math.round(((amounts.find((a) => a.line.key === nextBase.key)?.amount ?? 100) * 10)) / 10 } : null) });
  };
  const step = draft.baseAmount >= 100 ? 50 : 10;
  const search = { ingredients, aliases };

  return (
    <View style={styles.stack}>
      <View style={styles.head}>
        <Caption tone="muted">{base ? `Everything follows the ${base.name.toLowerCase()}.` : 'Add what goes in.'}</Caption>
        <Choice label="Show as" options={VIEWS} value={view} onChange={setView} />
      </View>
      <View role="list">
        {draft.lines.map((l, i) => {
          const isBase = l.key === draft.baseKey;
          const amount = amounts[i].amount;
          const shown = amount !== null ? formatQuantity(toQuantity(amount, l.unit) ?? { kind: 'count', value: amount, unit: l.unit || 'each' }) : '';
          return l.key === swapKey ? (
            <View key={l.key} style={[styles.swap, { borderBottomColor: ds.c.line }]}>
              <IngredientSearch {...search} label={`Swap ${l.name} for…`} autoFocus onCancel={() => setSwapKey(null)} onPick={(p) => { change(l.key, { id: p.id, name: p.name }); setSwapKey(null); }} />
            </View>
          ) : (
            <View key={l.key} role="listitem" style={[styles.line, { borderBottomColor: ds.c.line }]}>
              <IngredientThumb id={l.id} name={l.name} size={36} />
              <PressableScale accessibilityLabel={`${l.name}. Swap it`} onPress={() => setSwapKey(l.key)} style={styles.name}>
                <Body numberOfLines={1}>{l.name}</Body>
                {isBase ? <Caption tone="accent">The base</Caption> : view === 'parts' && l.parts !== null && base?.parts ? <Caption tone="muted">{partsText(l.parts, base.parts)}</Caption> : null}
              </PressableScale>
              {isBase ? (
                <View style={[styles.box, { backgroundColor: ds.c.raised }]}>
                  <PressableScale accessibilityLabel={`Less ${l.name}`} onPress={() => set({ baseAmount: Math.max(step, draft.baseAmount - step) })} style={styles.tap}>
                    <IconSymbol name="minus" size={16} color={ds.c.ink} />
                  </PressableScale>
                  <Spec>{shown}</Spec>
                  <PressableScale accessibilityLabel={`More ${l.name}`} onPress={() => set({ baseAmount: draft.baseAmount + step })} style={styles.tap}>
                    <IconSymbol name="plus" size={16} color={ds.c.ink} />
                  </PressableScale>
                </View>
              ) : l.parts !== null && view === 'parts' ? (
                <NumberField label={`Parts of ${l.name}`} value={String(l.parts)} onChange={(v) => v > 0 && change(l.key, { parts: v })} suffix="parts" />
              ) : l.parts !== null ? (
                <Spec tone="muted">{shown}</Spec>
              ) : (
                <View style={styles.own}>
                  <NumberField label={`How much ${l.name}`} value={l.amount} onChange={(v) => change(l.key, { amount: v > 0 ? String(v) : '' })} placeholder="to taste" />
                  <PressableScale accessibilityLabel={`Unit: ${l.unit || 'none'}. Change`} onPress={() => change(l.key, { unit: UNITS[(UNITS.indexOf(l.unit as (typeof UNITS)[number]) + 1) % UNITS.length] })} style={styles.unit}>
                    <Caption>{l.unit || '—'}</Caption>
                  </PressableScale>
                </View>
              )}
              <PressableScale accessibilityLabel={`Remove ${l.name}`} onPress={() => remove(l)} style={styles.tap}>
                <IconSymbol name="xmark" size={14} color={ds.c.muted} />
              </PressableScale>
            </View>
          );
        })}
      </View>
      <IngredientSearch {...search} label="Add an ingredient" onPick={(p) => set({ lines: [...draft.lines, { key: `n${Date.now().toString(36)}`, id: p.id, name: p.name, parts: null, unit: 'g', amount: '' }] })} />
      <View style={styles.facts}>
        <View style={[styles.fact, { backgroundColor: ds.c.raised }]}>
          <Caption tone="muted">Makes about</Caption>
          <Body>{makes ? formatQuantity({ kind: 'ml', value: makes, unit: 'ml' }) : 'Set by your first batch'}</Body>
        </View>
      </View>
      <Caption tone="muted">“Makes about” is a guess from the weights. Your first batch in Make mode sets the real number.</Caption>
    </View>
  );
}

/** A small number field (parts, or a line's own amount). */
function NumberField({ label, value, onChange, suffix, placeholder }: { label: string; value: string; onChange: (v: number) => void; suffix?: string; placeholder?: string }) {
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
  stack: { gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, flexWrap: 'wrap' },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget + space.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  swap: { paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  name: { flex: 1, minHeight: layout.minTapTarget, justifyContent: 'center' },
  box: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill, minHeight: 40, paddingHorizontal: space.xs },
  tap: { minWidth: layout.minTapTarget, minHeight: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  own: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  input: { minWidth: 56, maxWidth: 80, textAlign: 'center', paddingVertical: space.xs },
  suffix: { paddingRight: space.sm },
  unit: { minWidth: layout.minTapTarget, minHeight: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  facts: { flexDirection: 'row', gap: space.sm },
  fact: { flex: 1, borderRadius: radius.control, padding: space.md, gap: 2 },
});
