import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { Body, Button, Caption, DsText, Field, IngredientThumb, PressableScale, TextLink, useDs } from '@/components/ds';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { useItemLocations } from '@/hooks/useBackBar';
import { useSwapSource, useSwapSpecLine, useUndoSwap } from '@/hooks/useBulk';
import { useCocktail } from '@/hooks/useCocktails';
import { useDropdowns } from '@/hooks/useDropdowns';
import { plainDbMessage } from '@/lib/dbError';
import { closestIngredients, searchIngredients } from '@/lib/ingredientNames';
import type { SpecLine } from '@/lib/spec';
import { tidyAmount } from '@/lib/specDefaults';
import { bottlesFor } from '@/lib/swapBottle';

export interface LineSwapped {
  itemId: string;
  lineKey: string;
  /** The version before the swap: what Undo puts back. */
  version: number;
  title: string;
}

interface SwapLineSheetProps {
  itemId: string;
  barId: string | null;
  line: SpecLine;
  /** Off when this role can't see the amounts. */
  amounts: boolean;
  onClose: () => void;
  onSaved: (done: LineSwapped) => void;
  /** The ingredient's own page, in place of a fix. */
  onOpen: () => void;
}

type Option = { id: string; name: string | null };

// The box rings in the accent while it has focus, so the browser's own focus box is switched off (as IngredientSearch does).
const NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

/**
 * Fix one line of a spec from the drink page (board KittySwap): what you
 * actually pour, the venue's back bar first ("Blended Scotch" offers its
 * bottles before anything is typed), and the amount if that's off too.
 * Saved as a new version, so the old spec stays in History.
 */
export function SwapLineSheet({ itemId, barId, line, amounts, onClose, onSaved, onOpen }: SwapLineSheetProps) {
  const ds = useDs();
  const { data } = useDropdowns({ ingredients: true });
  const drink = useCocktail(itemId).data?.name ?? 'this drink';
  const pours = useSwapSource(barId);
  const spots = useItemLocations(barId);
  const save = useSwapSpecLine();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);
  const [amount, setAmount] = useState(line.value === null ? '' : String(line.value));
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const name = line.ingredient ?? 'this ingredient';

  // Shared ingredients and this venue's own: another venue's house bottles can't go in this drink.
  const ingredients = useMemo(() => (data?.ingredients ?? []).filter((i) => !i.bar_id || i.bar_id === barId), [data?.ingredients, barId]);
  const coreIds = useMemo(() => new Set(data?.coreIngredientIds ?? []), [data?.coreIngredientIds]);
  // The back bar: the venue's own bottles, what its specs already pour, and what has a spot on its map.
  const backBar = useMemo(() => {
    const ids = new Set<string>();
    for (const d of pours.data?.drinks ?? []) for (const l of d.lines) if (l.ingredientId) ids.add(l.ingredientId);
    for (const s of spots.data ?? []) ids.add(s.item_id);
    for (const i of ingredients) if (i.bar_id) ids.add(i.id);
    return ids;
  }, [pours.data, spots.data, ingredients]);

  const q = query.trim();
  const found: Option[] = q
    ? (() => {
        const hits = searchIngredients(q, ingredients, { aliases: data?.ingredientAliases, coreIds, limit: 12 });
        return hits.length ? hits : closestIngredients(q, ingredients, { coreIds });
      })()
    : line.ingredientId
      ? bottlesFor(line.ingredientId, ingredients, barId, 12)
      : [];
  const options = found.filter((o) => o.id !== line.ingredientId);
  const ours = barId ? options.filter((o) => backBar.has(o.id)) : options;
  const rest = barId ? options.filter((o) => !backBar.has(o.id)) : [];

  const typed = tidyAmount(amount);
  const nextAmount = typed === '' ? null : Number(typed);
  const badAmount = nextAmount !== null && !Number.isFinite(nextAmount);
  const amountChanged = amounts && !badAmount && nextAmount !== line.value;
  const unit = line.unit ?? '';
  const howMuch = `${nextAmount ?? 'no amount'}${nextAmount !== null && unit ? ` ${unit}` : ''}`;

  const run = () => {
    if (!line.ingredientId || (!picked && !amountChanged) || badAmount) return;
    setError(null);
    save.mutate(
      {
        itemId,
        lineId: line.key,
        ingredientId: picked?.id ?? line.ingredientId,
        amount: amountChanged ? nextAmount : undefined,
        note: picked ? `Swapped ${name} for ${picked.name}` : `${name} to ${howMuch}`,
      },
      {
        onSuccess: (done) =>
          onSaved({ itemId, lineKey: line.key, version: done.version, title: picked ? `${drink} now uses ${picked.name}` : `${drink} now takes ${howMuch} of ${name}` }),
        onError: (e) => setError(plainDbMessage(e) ?? 'Couldn’t save that. Try again.'),
      }
    );
  };

  const row = (o: Option, away: boolean) => {
    const on = picked?.id === o.id;
    return (
      <PressableScale
        key={o.id}
        role="radio"
        aria-checked={on}
        accessibilityLabel={away ? `${o.name}, not on your back bar yet` : (o.name ?? '')}
        onPress={() => setPicked(on ? null : { id: o.id, name: o.name ?? '' })}
        style={[styles.option, { borderBottomColor: ds.c.line }]}
      >
        <IngredientThumb id={o.id} name={o.name ?? ''} size={40} />
        <View style={styles.flex}>
          <Body numberOfLines={1}>{o.name}</Body>
          {away ? <Caption tone="muted">Not on your back bar yet · adds it</Caption> : null}
        </View>
        {on ? <IconSymbol name="checkmark" size={18} color={ds.accentText} /> : null}
      </PressableScale>
    );
  };

  return (
    <MenuSheet
      visible
      onClose={onClose}
      plain
      eyebrow={drink}
      title="What do you pour instead?"
      footer={
        <View style={styles.footer}>
          <Button
            label={save.isPending ? 'Saving…' : picked ? `Use ${picked.name}` : amountChanged ? `Use ${howMuch}` : 'Pick a bottle'}
            onPress={run}
            disabled={save.isPending || badAmount || (!picked && !amountChanged)}
          />
          <Caption tone="muted" style={styles.center}>{`Changes the ${drink} for the whole team. The old spec stays in its history.`}</Caption>
        </View>
      }
    >
      <View style={styles.inputs}>
        {amounts ? (
          <View style={[styles.amount, { backgroundColor: ds.c.raised, borderColor: badAmount || focused ? ds.accentText : ds.c.line }]}>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'decimal-pad'}
              returnKeyType="done"
              selectTextOnFocus
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              maxLength={8}
              aria-label={`Amount of ${name}${unit ? `, ${unit}` : ''}`}
              style={[styles.amountInput, type.spec, { fontFamily: fontFamilies.monoMedium, color: ds.c.ink }, NO_OUTLINE]}
            />
            {unit ? <Caption tone="muted">{unit}</Caption> : null}
          </View>
        ) : null}
        <View style={styles.flex}>
          <Field label={`Search for what replaces ${name}`} hideLabel icon="magnifyingglass" value={query} onChangeText={setQuery} placeholder={name} autoCapitalize="none" autoCorrect={false} />
        </View>
      </View>
      {badAmount ? <Caption tone="accent">The amount is a number, like 22.5 or 3/4.</Caption> : null}
      <View role="radiogroup" accessibilityLabel={`What replaces ${name}`}>
        {ours.length && barId ? <Caption tone="muted">On your back bar</Caption> : null}
        {ours.map((o) => row(o, false))}
        {rest.length ? <Caption tone="muted" style={styles.group}>Everything else</Caption> : null}
        {rest.map((o) => row(o, true))}
        {q && !options.length && data?.ingredients ? <Body tone="muted">{`Nothing called “${q}”. Add it to the library first, then come back.`}</Body> : null}
      </View>
      {error ? <Caption tone="accent">{error}</Caption> : null}
      {line.ingredientId ? <TextLink label={`Open ${name}`} tone="ink" onPress={onOpen} /> : null}
    </MenuSheet>
  );
}

/** After a fix (board KittyDone): what changed, that the old spec is kept, and Undo. */
export function SwapDone({ done, onUndone }: { done: LineSwapped; onUndone: () => void }) {
  const ds = useDs();
  const undo = useUndoSwap();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);
  return (
    <View role="status" style={[styles.done, { backgroundColor: ds.c.raised, borderColor: ds.c.line }]}>
      <IconSymbol name="checkmark" size={16} color={ds.accentText} />
      <View style={styles.flex}>
        <DsText variant="label" style={{ fontFamily: fontFamilies.bodySemiBold }}>
          {done.title}
        </DsText>
        <Caption tone="muted">{error ?? 'The old spec is in its history.'}</Caption>
      </View>
      <PressableScale
        role="button"
        accessibilityLabel={`Undo: ${done.title}`}
        disabled={undo.isPending}
        onPress={() =>
          undo.mutate([{ itemId: done.itemId, version: done.version }], {
            onSuccess: onUndone,
            onError: (e) => setError(plainDbMessage(e) ?? 'Couldn’t undo. The old spec is still in History.'),
          })
        }
        style={styles.undo}
      >
        <DsText variant="label" color={ds.accentText} style={{ fontFamily: fontFamilies.bodySemiBold }}>
          {undo.isPending ? 'Undoing…' : 'Undo'}
        </DsText>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  done: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.control, borderWidth: 1, paddingLeft: space.lg, paddingVertical: space.sm, marginTop: space.md },
  undo: { minWidth: layout.minTapTarget, minHeight: layout.minTapTarget, paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center' },
  inputs: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  amount: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget, borderRadius: radius.control, borderWidth: 1, paddingHorizontal: space.md },
  amountInput: { width: 56, minHeight: layout.minTapTarget, padding: 0 },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth },
  group: { paddingTop: space.md },
  flex: { flex: 1 },
  footer: { gap: space.sm },
  center: { textAlign: 'center' },
});
