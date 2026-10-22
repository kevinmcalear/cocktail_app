import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { Body, Button, Caption, Field, TextLink, useBreakpoint, useDs } from '@/components/ds';
import { useToast } from '@/components/ds/Toast';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { useSwapSpecLine, useUndoSwap } from '@/hooks/useBulk';
import { useCocktail } from '@/hooks/useCocktails';
import { plainDbMessage } from '@/lib/dbError';
import type { SpecLine } from '@/lib/spec';
import { amountBox, amountEdit } from '@/lib/swapBottle';
import { useSettingsStore } from '@/store/useSettingsStore';

import { BottleOptions, useBottleOptions } from './BottleOptions';
import { ACTION_BAR_HEIGHT } from './DrinkActionBar';

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
  const drink = useCocktail(itemId).data?.name ?? 'this drink';
  const save = useSwapSpecLine();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);
  // The amount reads in the unit the page reads in (2 oz shows as 60 ml when the spec reads in ml).
  const specUnit = useSettingsStore((s) => s.specUnit);
  const [box] = useState(() => amountBox(line, specUnit));
  const [amount, setAmount] = useState(box.text);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const name = line.ingredient ?? 'this ingredient';

  // Shared ingredients and this venue's own: another venue's house bottles can't go in this drink.
  const options = useBottleOptions(line.ingredientId, barId, query);

  // Only an edited amount is saved, in the unit the box reads in; a bottle-only swap leaves the stored amount alone.
  const edit = amountEdit(box, amount);
  const badAmount = edit === 'invalid';
  const change = amounts && edit && edit !== 'invalid' ? edit : undefined;
  const amountChanged = !!change;
  const unit = box.unit ?? '';
  const howMuch = change ? `${change.value ?? 'no amount'}${change.value !== null && unit ? ` ${unit}` : ''}` : '';

  const run = () => {
    if (!line.ingredientId || (!picked && !amountChanged) || badAmount) return;
    setError(null);
    save.mutate(
      {
        itemId,
        lineId: line.key,
        ingredientId: picked?.id ?? line.ingredientId,
        amount: change,
        note: picked ? `Swapped ${name} for ${picked.name}` : `${name} to ${howMuch}`,
      },
      {
        onSuccess: (done) =>
          onSaved({ itemId, lineKey: line.key, version: done.version, title: picked ? `${drink} now uses ${picked.name}` : `${drink} now takes ${howMuch} of ${name}` }),
        onError: (e) => setError(plainDbMessage(e) ?? 'Couldn’t save that. Try again.'),
      }
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
      <BottleOptions label={`What replaces ${name}`} barId={barId} options={options} pickedId={picked?.id ?? null} onPick={setPicked} />
      {options.none ? <Body tone="muted">{`Nothing called “${query.trim()}”. Add it to the library first, then come back.`}</Body> : null}
      {error ? <Caption tone="accent">{error}</Caption> : null}
      {line.ingredientId ? <TextLink label={`Open ${name}`} tone="ink" onPress={onOpen} /> : null}
    </MenuSheet>
  );
}

/**
 * After a fix (board KittyDone): a toast saying what changed, that the old
 * spec is kept, and Undo. On a phone it floats above the drink's pinned
 * action bar.
 */
export function useSwapToast() {
  const toast = useToast();
  const undo = useUndoSwap();
  const phone = useBreakpoint() === 'phone';
  return (done: LineSwapped) =>
    toast.show({
      title: done.title,
      detail: 'The old spec is in its history.',
      lift: phone ? ACTION_BAR_HEIGHT - space.lg : 0,
      action: {
        label: 'Undo',
        onPress: () =>
          undo.mutate([{ itemId: done.itemId, version: done.version }], {
            onError: (e) => toast.show({ title: 'Couldn’t undo', detail: plainDbMessage(e) ?? 'The old spec is still in History.' }),
          }),
      },
    });
}

const styles = StyleSheet.create({
  inputs: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  amount: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget, borderRadius: radius.control, borderWidth: 1, paddingHorizontal: space.md },
  amountInput: { width: 56, minHeight: layout.minTapTarget, padding: 0 },
  flex: { flex: 1 },
  footer: { gap: space.sm },
  center: { textAlign: 'center' },
});
