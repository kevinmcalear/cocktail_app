import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, PressableScale, Tag, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useSetSwaps, type RunSheetData } from '@/hooks/useRunSheet';
import { pourSuggestions, type RunDrink, type RunSheet, type SheetDrink, type SheetLine } from '@/lib/runSheet';

import { RunSwapSheet } from './RunSwapSheet';

function DrinkSpec({ drink, onLine }: { drink: SheetDrink; onLine: (line: SheetLine) => void }) {
  const ds = useDs();
  return (
    <View role="group" aria-label={drink.name} style={[styles.card, { backgroundColor: ds.c.surface }]}>
      <View style={styles.head}>
        <DsText variant="headline" style={styles.name}>{drink.name}</DsText>
        <Caption tone="muted" style={{ fontFamily: fontFamilies.mono }}>× {drink.serves.toLocaleString('en-GB')}</Caption>
      </View>
      {drink.lines.length ? null : <Body tone="muted">No spec to swap in.</Body>}
      {drink.lines.map((l, i) => (
        <PressableScale
          key={`${l.ingredientId}-${i}`}
          role="button"
          accessibilityLabel={`${l.per} ${l.name}${l.was ? `, swapped from ${l.was.name} for this menu` : ''}. Swap`}
          onPress={() => onLine(l)}
          style={[styles.line, { borderTopColor: ds.c.line }]}
        >
          <DsText variant="label" style={styles.amount}>{l.per}</DsText>
          <View style={{ flex: 1, minWidth: 0 }}>
            <DsText variant="label">{l.name}</DsText>
            {l.was ? (
              <Caption tone="muted">
                <Caption tone="muted" style={styles.struck}>{l.was.name}</Caption> · for this menu
              </Caption>
            ) : null}
          </View>
          {l.was ? <Tag label="Swapped" tone="accent" /> : null}
          <IconSymbol name="arrow.up.and.down" size={16} color={ds.c.muted} />
        </PressableScale>
      ))}
    </View>
  );
}

/** Step 2: this menu's specs, with its swaps (board "2. Specs for this menu"). */
export function SpecsStep({ data, sheet }: { data: RunSheetData; sheet: RunSheet }) {
  const ds = useDs();
  const setSwaps = useSetSwaps(data.menu.id);
  const [showAll, setShowAll] = useState(false);
  const [swapping, setSwapping] = useState<{ drink: RunDrink; line: SheetLine } | null>(null);
  const cocktails = sheet.drinks.filter((d) => data.drinks.find((x) => x.id === d.id)?.itemType === 'cocktail');
  const swapped = cocktails.filter((d) => d.lines.some((l) => l.was));
  const shown = showAll || !swapped.length ? cocktails : swapped;
  const hidden = cocktails.filter((d) => !shown.includes(d));
  const [suggestion] = pourSuggestions(data.drinks.filter((d) => d.itemType === 'cocktail'), data.swaps, data.items, data.brandBottles);
  const open = (d: SheetDrink, line: SheetLine) => setSwapping({ drink: data.drinks.find((x) => x.id === d.id)!, line });

  return (
    <View style={{ gap: space.xl }}>
      <Body tone="muted">Swap a bottle or a garnish for this night. Your library specs stay as they are.</Body>
      {suggestion ? (
        <View style={[styles.suggest, { backgroundColor: ds.c.raised }]}>
          <View style={{ flex: 1 }}>
            <DsText variant="label" style={{ fontFamily: fontFamilies.bodySemiBold }}>Pour {suggestion.bottle.name} everywhere?</DsText>
            <Caption tone="muted">
              {suggestion.bottle.kindName ?? 'It'} shows up in {suggestion.drinkCount} {suggestion.drinkCount === 1 ? 'drink' : 'drinks'}. A brand on this sheet makes one.
            </Caption>
          </View>
          <Button
            label={suggestion.drinkCount === 1 ? 'Swap it' : `Swap all ${suggestion.drinkCount}`}
            size="sm"
            onPress={() => setSwaps.mutate(suggestion.swaps.map((s) => ({ ...s, to: { id: suggestion.bottle.id, name: suggestion.bottle.name } })))}
          />
        </View>
      ) : null}
      {shown.map((d) => (
        <DrinkSpec key={d.id} drink={d} onLine={(line) => open(d, line)} />
      ))}
      {hidden.length ? (
        <View style={[styles.card, styles.collapsed, { backgroundColor: ds.c.surface }]}>
          <View style={{ flex: 1 }}>
            <Body style={{ fontFamily: fontFamilies.bodySemiBold }}>{hidden.map((d) => d.name).join(', ')}</Body>
            <Caption tone="muted">No swaps</Caption>
          </View>
          <Button label="Show" size="sm" variant="secondary" accessibilityLabel="Show the drinks with no swaps" onPress={() => setShowAll(true)} />
        </View>
      ) : null}
      {!cocktails.length ? <Body tone="muted">No cocktails on this menu yet.</Body> : null}
      {swapping ? <RunSwapSheet data={data} drink={swapping.drink} line={swapping.line} onClose={() => setSwapping(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, padding: space.lg, gap: space.xs, borderCurve: 'continuous' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: space.sm },
  name: { fontFamily: fontFamilies.instrument },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget, paddingVertical: space.xs, borderTopWidth: StyleSheet.hairlineWidth },
  amount: { width: 80, fontFamily: fontFamilies.monoMedium },
  struck: { textDecorationLine: 'line-through' },
  suggest: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.card, padding: space.md, paddingLeft: space.lg },
  collapsed: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
