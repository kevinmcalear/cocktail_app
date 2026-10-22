import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, IngredientThumb, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';
import { useBackBarIds } from '@/hooks/useBackBar';
import { useDropdowns } from '@/hooks/useDropdowns';
import { closestIngredients, searchIngredients } from '@/lib/ingredientNames';
import { bottlesFor } from '@/lib/swapBottle';

export type BottleOption = { id: string; name: string | null };

/**
 * What can replace a bottle: what's typed, or before anything is, the other
 * bottles of its kind ("Blended Scotch" offers its bottles). The venue's back
 * bar first. Shared ingredients and this venue's own only.
 */
export function useBottleOptions(currentId: string | null, barId: string | null, query: string) {
  const { data } = useDropdowns({ ingredients: true });
  const ingredients = useMemo(() => (data?.ingredients ?? []).filter((i) => !i.bar_id || i.bar_id === barId), [data?.ingredients, barId]);
  const coreIds = useMemo(() => new Set(data?.coreIngredientIds ?? []), [data?.coreIngredientIds]);
  const backBar = useBackBarIds(barId, ingredients);
  const q = query.trim();
  const found: BottleOption[] = q
    ? (() => {
        const hits = searchIngredients(q, ingredients, { aliases: data?.ingredientAliases, coreIds, limit: 12 });
        return hits.length ? hits : closestIngredients(q, ingredients, { coreIds });
      })()
    : currentId
      ? bottlesFor(currentId, ingredients, barId, 12)
      : [];
  const options = found.filter((o) => o.id !== currentId);
  return {
    ours: barId ? options.filter((o) => backBar.has(o.id)) : options,
    rest: barId ? options.filter((o) => !backBar.has(o.id)) : [],
    /** Something was typed and nothing matches it. */
    none: !!q && !options.length && !!data?.ingredients,
  };
}

interface BottleOptionsProps {
  label: string;
  barId: string | null;
  options: { ours: BottleOption[]; rest: BottleOption[] };
  pickedId: string | null;
  /** Null when the picked row is pressed again. */
  onPick: (option: { id: string; name: string } | null) => void;
}

/** The choices as rows: "On your back bar", then "Everything else", each marked so. */
export function BottleOptions({ label, barId, options, pickedId, onPick }: BottleOptionsProps) {
  const ds = useDs();
  const row = (o: BottleOption, away: boolean) => {
    const on = pickedId === o.id;
    return (
      <PressableScale
        key={o.id}
        role="radio"
        aria-checked={on}
        accessibilityLabel={away ? `${o.name}, not on your back bar` : (o.name ?? '')}
        onPress={() => onPick(on ? null : { id: o.id, name: o.name ?? '' })}
        style={[styles.option, { borderBottomColor: ds.c.line }]}
      >
        <IngredientThumb id={o.id} name={o.name ?? ''} size={40} />
        <View style={styles.flex}>
          <Body numberOfLines={1}>{o.name}</Body>
          {away ? <Caption tone="muted">Not on your back bar</Caption> : null}
        </View>
        {on ? <IconSymbol name="checkmark" size={18} color={ds.accentText} /> : null}
      </PressableScale>
    );
  };
  return (
    <View role="radiogroup" accessibilityLabel={label}>
      {options.ours.length && barId ? <Caption tone="muted">On your back bar</Caption> : null}
      {options.ours.map((o) => row(o, false))}
      {options.rest.length ? <Caption tone="muted" style={styles.group}>Everything else</Caption> : null}
      {options.rest.map((o) => row(o, true))}
    </View>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth },
  group: { paddingTop: space.md },
  flex: { flex: 1 },
});
