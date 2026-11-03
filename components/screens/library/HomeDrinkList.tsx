import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Chip, Tag, useGutter } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { FilterRow } from '@/components/screens/library/LibraryChips';
import { space } from '@/constants/tokens';
import { useCollection } from '@/hooks/useCollection';
import { useDropdowns } from '@/hooks/useDropdowns';
import { useMyBar } from '@/hooks/useHomeBar';
import { useMyHadDrinks } from '@/hooks/useRankings';
import { useSearchCatalog } from '@/hooks/useSearchCatalog';
import { PERSONAL_CONTEXT } from '@/lib/barContextFilter';
import { itemHref } from '@/lib/itemRoutes';
import { methodWord, tileLine } from '@/lib/libraryFilters';
import { formatScore } from '@/lib/ranking';

type View_ = 'can' | 'saved' | 'ranked' | 'stirred' | 'shaken';
const VIEWS: { value: View_; label: string }[] = [
  { value: 'can', label: 'Can make' },
  { value: 'saved', label: 'Saved' },
  { value: 'ranked', label: 'Ranked' },
  { value: 'stirred', label: 'Stirred' },
  { value: 'shaken', label: 'Shaken' },
];
const CONTEXT = [PERSONAL_CONTEXT];

interface Entry {
  id: string;
  name: string;
  imageUrl: string | null;
  glass: string | null;
  /** Ready, "Need limes", or a score. */
  right?: { label: string; tone: 'success' | 'warning' | 'default' };
}

/**
 * Home's Drinks (Prod-drinks, Home): the chips Can make, Saved, Ranked and two
 * ways of making (Stirred, Shaken), then rows with a drawing, "Stirred · Coupe"
 * and, on the right, Ready, what to buy ("Need limes"), or your score.
 */
export function HomeDrinkList() {
  const gutter = useGutter();
  const bar = useMyBar();
  const { data: collection } = useCollection();
  const had = useMyHadDrinks().data ?? [];
  const { items } = useSearchCatalog(CONTEXT, { ingredients: false });
  const specs = useDropdowns().data;
  const [view, setView] = useState<View_>('can');

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const methodOf = (id: string) => {
    const m = byId.get(id)?.method_id;
    return m ? methodWord(specs?.methods.find((x) => x.id === m)?.name) : null;
  };
  const glassOf = (id: string) => {
    const g = byId.get(id)?.glassware_id;
    return g ? (specs?.glassware.find((x) => x.id === g)?.name ?? null) : null;
  };
  const ready: Entry[] = bar.canMake.map((d) => ({ id: d.id, name: d.name, imageUrl: d.imageUrl, glass: d.glass, right: { label: 'Ready', tone: 'success' } }));
  const away: Entry[] = bar.oneAway.flatMap((g) => g.drinks.map((d) => ({ id: d.id, name: d.name, imageUrl: d.imageUrl, glass: d.glass, right: { label: `Need ${g.bottles.map((b) => b.name.toLowerCase()).join(' and ')}`, tone: 'warning' as const } })));
  const canMake = [...ready, ...away].sort((a, b) => a.name.localeCompare(b.name));
  const rows: Entry[] =
    view === 'saved'
      ? (collection?.drinks ?? []).filter((d) => d.itemId && !d.releaseId).map((d) => ({ id: d.itemId!, name: d.name, imageUrl: d.imageUrl, glass: null, right: bar.canMakeIds.has(d.itemId!) ? { label: 'Ready', tone: 'success' as const } : undefined }))
      : view === 'ranked'
        ? [...new Map([...had].sort((a, b) => a.score - b.score).map((h) => [h.itemId, h])).values()].sort((a, b) => b.score - a.score).map((h) => ({ id: h.itemId, name: h.name, imageUrl: h.imageUrl, glass: null, right: { label: formatScore(h.score), tone: 'default' as const } }))
        : view === 'can'
          ? canMake
          : canMake.filter((e) => methodOf(e.id)?.toLowerCase() === view);

  return (
    <View style={styles.wrap}>
      <FilterRow label="Drinks" gutter={gutter} groups={[VIEWS.map((v) => <Chip key={v.value} look="outline" label={v.label} selected={view === v.value} onPress={() => setView(v.value)} />)]} />
      {rows.length ? (
        <View>
          {rows.map((e) => (
            <DrinkRow
              key={`${view}-${e.id}`}
              name={e.name}
              href={itemHref('Cocktail', e.id)}
              imageUrl={e.imageUrl}
              glass={e.glass}
              itemId={e.id}
              caption={tileLine(methodOf(e.id), glassOf(e.id)) ?? undefined}
              trailing={e.right ? <Tag label={e.right.label} tone={e.right.tone} /> : undefined}
            />
          ))}
        </View>
      ) : (
        <Body tone="muted">
          {view === 'saved' ? 'Tap the bookmark on any drink to save it here.' : view === 'ranked' ? 'Drinks you rank land here.' : bar.isLoading ? '' : 'Nothing here yet. Add bottles to your shelf and the drinks they make show up.'}
        </Body>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
});
