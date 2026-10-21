import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Body, Button, Caption, Chip, DsText, Headline, IngredientThumb, PressableScale, Sheet, useDs } from '@/components/ds';
import type { SortableRecipeItem } from '@/lib/recipeItem';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { QUICK_UNITS } from '@/lib/drinkWizard';
import { pressKey, quickAmounts, settleAmount } from '@/lib/specPad';

interface SpecPadProps {
  line: SortableRecipeItem;
  index: number;
  count: number;
  /** The line's next one, for "Next: Honey-Ginger Syrup". */
  nextName: string | null;
  onChange: (updates: Partial<SortableRecipeItem>) => void;
  onNext: () => void;
  onSwap: () => void;
  onClose: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];
const SHEET_PAD = { paddingHorizontal: space.xl, paddingBottom: space.xxl };
const NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

/**
 * Tap an amount: the spec pad (drink-edit-amount). The amount in big mono on
 * its own keypad, the unit as chips, the usual jiggers one tap away, Optional
 * and a note, then Next to walk the whole spec without closing it. Every
 * change lands on the page as it's made (Undo takes it back). On the web the
 * keyboard types into it too.
 */
export function SpecPad({ line, index, count, nextName, onChange, onNext, onSwap, onClose }: SpecPadProps) {
  const ds = useDs();
  const [amount, setAmount] = useState(line.amount ?? '');
  const [noteOpen, setNoteOpen] = useState(!!line.preparation_notes);
  const unit = line.unit || 'ml';
  const quick = quickAmounts(unit);
  const type = (key: string) => {
    const next = pressKey(amount, key);
    setAmount(next);
    onChange({ amount: settleAmount(next) });
  };
  const pick = (value: string) => {
    setAmount(value);
    onChange({ amount: value });
  };

  // The web: digits, the point and Backspace type; Return goes on to the next line.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Enter') return void (e.preventDefault(), onNext());
      const key = e.key === 'Backspace' ? '⌫' : e.key;
      if (!KEYS.includes(key)) return;
      e.preventDefault();
      setAmount((was) => {
        const next = pressKey(was, key);
        onChange({ amount: settleAmount(next) });
        return next;
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onChange, onNext]);

  return (
    <Sheet style={SHEET_PAD} visible onClose={onClose} accessibilityLabel={`Amount for ${line.name}`}>
      <View style={styles.body}>
        <View style={styles.head}>
          <IngredientThumb id={line.ingredient_id} name={line.name} size={44} />
          <View style={styles.flex}>
            <Headline numberOfLines={1}>{line.name}</Headline>
            <Caption tone="muted">{`Line ${index + 1} of ${count}`}</Caption>
          </View>
          <Button label="Swap" size="sm" variant="secondary" onPress={onSwap} />
        </View>

        <View style={styles.amountRow} accessibilityLiveRegion="polite" accessibilityLabel={`${amount || 'No amount'} ${unit}`}>
          <DsText variant="display" style={styles.amount}>
            {amount || '0'}
          </DsText>
          <View style={[styles.caret, { backgroundColor: ds.accentText }]} />
          <DsText variant="headline" color={ds.c.muted}>
            {unit}
          </DsText>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} role="radiogroup" accessibilityLabel="Unit">
          {QUICK_UNITS.map((u) => (
            <Chip key={u} label={u} selected={u === unit} look="outline" onPress={() => onChange({ unit: u })} />
          ))}
        </ScrollView>

        {quick.length ? (
          <View style={styles.quick}>
            {quick.map((q) => (
              <PressableScale
                key={q.value}
                role="button"
                accessibilityLabel={`${q.label} ${unit}`}
                onPress={() => pick(q.value)}
                style={[styles.quickKey, { backgroundColor: ds.c.raised }, amount === q.value && { borderColor: ds.accentText, borderWidth: 1.5 }]}
              >
                <DsText variant="label" style={styles.mono}>
                  {q.label}
                </DsText>
              </PressableScale>
            ))}
          </View>
        ) : null}

        <View style={styles.flags}>
          <Chip label="Optional" multi selected={!!line.is_optional} look="outline" onPress={() => onChange({ is_optional: !line.is_optional })} />
          {noteOpen ? null : <Chip label="+ Note" selected={false} look="outline" onPress={() => setNoteOpen(true)} />}
        </View>
        {noteOpen ? (
          <TextInput
            value={line.preparation_notes ?? ''}
            onChangeText={(t) => onChange({ preparation_notes: t })}
            placeholder="floated on top, fine strained…"
            placeholderTextColor={ds.c.muted}
            accessibilityLabel="Note on this line"
            autoFocus={!line.preparation_notes}
            style={[styles.note, NO_OUTLINE, { color: ds.c.ink, backgroundColor: ds.c.raised }]}
          />
        ) : null}

        <View style={styles.pad}>
          {[0, 3, 6, 9].map((row) => (
            <View key={row} style={styles.padRow}>
              {KEYS.slice(row, row + 3).map((k) => (
                <PressableScale key={k} role="button" accessibilityLabel={k === '⌫' ? 'Delete a digit' : k === '.' ? 'Point' : k} onPress={() => type(k)} style={[styles.key, { backgroundColor: ds.c.raised }]}>
                  <DsText style={styles.keyText}>{k}</DsText>
                </PressableScale>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.foot}>
          <Button label="Done" variant="secondary" onPress={onClose} />
          {nextName ? (
            <View style={styles.flex}>
              <Button label={`Next: ${nextName}`} onPress={onNext} />
            </View>
          ) : null}
        </View>
        {Platform.OS === 'web' ? <Body tone="muted" style={styles.hint}>Type the amount; Return goes on to the next line.</Body> : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md, paddingBottom: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  amount: { fontFamily: fontFamilies.monoMedium, fontVariant: ['tabular-nums'] },
  caret: { width: 2, height: 44, alignSelf: 'center' },
  chips: { gap: space.sm },
  quick: { flexDirection: 'row', gap: space.xs + 2 },
  quickKey: { flex: 1, minHeight: 40, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  mono: { fontFamily: fontFamilies.monoMedium },
  flags: { flexDirection: 'row', gap: space.sm },
  note: { ...type.body, fontFamily: fontFamilies.body, borderRadius: radius.control, paddingHorizontal: space.md, minHeight: layout.minTapTarget },
  pad: { gap: space.xs + 2 },
  padRow: { flexDirection: 'row', gap: space.xs + 2 },
  key: { flex: 1, height: 48, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  keyText: { ...type.headline, fontFamily: fontFamilies.monoMedium },
  foot: { flexDirection: 'row', gap: space.sm },
  hint: { textAlign: 'center' },
});
