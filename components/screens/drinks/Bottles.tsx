import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Chip } from '@/components/ds';
import { ListGroup, ListRow } from '@/components/ds/ListGroup';
import { FilterRow } from '@/components/screens/library/LibraryChips';
import { space } from '@/constants/tokens';
import { useItemLocations } from '@/hooks/useBackBar';
import { useStockOnHand } from '@/hooks/useStockCounts';
import { useTonight } from '@/hooks/useTonight';
import { useTonightPrep } from '@/hooks/useTonightPrep';
import { bottleKind, bottleLine, countText, isLow, orderSummary, orderText } from '@/lib/drinksTab';
import type { Show } from '@/lib/libraryFilters';
import { shareText } from '@/lib/shareLink';
import { onHandByItem, parByItem } from '@/lib/stock';
import type { SearchItem } from '@/types/search';

import type { DrinkListRowProps } from './DrinksParts';

/** Bottles' Low chip, beside the kinds. */
export const LOW = 'low';

/**
 * What Bottles says about each bottle (Sta-capsules, Bottles): its kind and
 * the drinks it's in ("Amaro & aperitivo · in 4 drinks"), the last count on
 * the right (0 in amber), and whether it's under par. Counts and par come
 * from the back bar (stock_on_hand, item_locations); below the locations
 * capability both are empty and a row has no count.
 */
export function useBottleFacts(barId: string | null, published: readonly SearchItem[]) {
  const onHand = useStockOnHand(barId).data;
  const spots = useItemLocations(barId).data;
  return useMemo(() => {
    const have = onHandByItem(onHand ?? []);
    const par = parByItem(spots ?? []);
    const usedIn = new Map<string, string[]>();
    for (const d of published) {
      if (d.category !== 'Cocktail') continue;
      for (const id of new Set((d.recipes ?? []).map((l) => l.display_ingredient_id).filter((x): x is string => !!x))) usedIn.set(id, [...(usedIn.get(id) ?? []), d.name]);
    }
    const low = (i: SearchItem) => isLow(have[i.id], par[i.id]);
    const row = (i: SearchItem): Pick<DrinkListRowProps, 'line' | 'end'> => {
      const count = countText(have[i.id]);
      return { line: bottleLine(bottleKind(i.name), usedIn.get(i.id) ?? []), end: count ? { text: count, tone: have[i.id]!.value === 0 || low(i) ? 'warn' : 'muted' } : null };
    };
    return { low, row };
  }, [onHand, spots, published]);
}

/** Bottles' rows for the picked chip: a kind ("Gin"), Low, or all of them. */
export function bottlesFor(items: readonly SearchItem[], kind: string | undefined, low: (i: SearchItem) => boolean): SearchItem[] {
  if (!kind) return [...items];
  return items.filter((i) => (kind === LOW ? low(i) : bottleKind(i.name) === kind));
}

/** Bottles' chips (Sta-capsules): All, each kind the bar has, Low when anything is under par; then Garnishes and Needs a price. */
export function BottleChips({
  bottles,
  kind,
  low,
  others,
  show,
  count,
  gutter,
  whole,
  onKind,
  onShow,
}: {
  bottles: readonly SearchItem[];
  kind: string | undefined;
  low: (i: SearchItem) => boolean;
  others: readonly { value: Show; label: string }[];
  show: Show;
  count: (value: Show) => number;
  gutter: number;
  whole: boolean;
  onKind: (kind: string | undefined) => void;
  onShow: (value: Show) => void;
}) {
  const kinds = [...new Set(bottles.map((b) => bottleKind(b.name)).filter((k): k is string => !!k))].sort();
  const lows = bottles.filter(low).length;
  const on = (k: string | undefined) => show === 'bottles' && kind === k;
  return (
    <FilterRow
      label="Which bottles"
      gutter={gutter}
      whole={whole}
      groups={[
        [
          <Chip key="all" label="All" count={bottles.length} selected={on(undefined)} onPress={() => onKind(undefined)} />,
          ...kinds.map((k) => <Chip key={k} label={k} count={bottles.filter((b) => bottleKind(b.name) === k).length} selected={on(k)} onPress={() => onKind(k)} />),
          ...(lows ? [<Chip key={LOW} label="Low" count={lows} selected={on(LOW)} onPress={() => onKind(LOW)} />] : []),
        ],
        others.map((f) => <Chip key={f.value} label={f.label} count={count(f.value)} selected={show === f.value} onPress={() => onShow(f.value)} />),
      ]}
    />
  );
}

/**
 * To order (Sta-capsules, Bottles): what tonight's lists need bought, from
 * Prep's own order (lib/prep), with Export sending it as text to share with a
 * supplier. Nothing to order, or no Prep, shows nothing.
 */
export function ToOrder({ barId }: { barId: string }) {
  const tonight = useTonight(barId);
  const [now] = useState(() => new Date());
  const order =
    useTonightPrep(
      barId,
      tonight.menus.map((m) => m.id),
      now
    ).prep?.order ?? [];
  const sub = orderSummary(order);
  if (!sub) return null;
  return (
    <View style={styles.order}>
      <ListGroup>
        <ListRow first icon="doc.text" title="To order" detail={sub} end={<Button label="Export" size="sm" variant="secondary" accessibilityLabel="Export the order" onPress={() => void shareText(orderText(order), 'To order')} />} />
      </ListGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  order: { paddingTop: space.md },
});
