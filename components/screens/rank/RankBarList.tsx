import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Caption, SheetScrollView } from '@/components/ds';
import { TonightLabel } from '@/components/screens/tonight/TonightParts';
import { SearchField } from '@/components/search/SearchField';
import { space } from '@/constants/tokens';
import { useMenuEditions } from '@/hooks/useMenuRuns';
import { useMyHadDrinks } from '@/hooks/useRankings';
import { findDrinks } from '@/lib/discover';
import { beforeLine, latestByDrink } from '@/lib/rankIt';

import { RankRow } from './RankFindParts';
import type { RankPick } from './RankFindSheet';

/**
 * A bar's list on now in the Rank it sheet (Loop-rank, A bar's menu): "On now
 * · Autumn", its drinks, "Your 8.4 in August" on one you ranked here before,
 * and a field to find one. Picking a drink ranks it, had at this bar.
 */
export function RankBarList({ bar, onPick }: { bar: { id: string; name: string }; onPick: (p: RankPick) => void }) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const editions = useMenuEditions(bar.id);
  const now = (editions.data ?? []).find((e) => e.is_current && e.drinks.length);
  const had = useMyHadDrinks().data ?? [];
  const before = latestByDrink(had.filter((h) => h.venue?.id === bar.id));
  const today = new Date();
  const shown = now ? findDrinks(now.drinks, query) : [];
  return (
    <SheetScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xl }]} keyboardShouldPersistTaps="handled">
      <SearchField query={query} onQuery={setQuery} placeholder="Find a drink on the menu" />
      {editions.isPending ? <Caption tone="muted">Loading the list…</Caption> : null}
      {editions.isError ? <Caption tone="muted">{`Couldn’t load ${bar.name}’s list. Check your connection and try again.`}</Caption> : null}
      {editions.isSuccess && !now ? <Caption tone="muted">{`No list on now at ${bar.name} that we know of. Go back and search for the drink.`}</Caption> : null}
      {now ? (
        <View role="region" aria-label={`On now, ${now.name}`} style={styles.section}>
          <TonightLabel title={`On now · ${now.name}`} />
          <View role="list">
            {shown.map((d, i) => {
              const mine = before.get(d.id);
              return <RankRow key={d.id} itemId={d.id} name={d.name} sub={mine ? beforeLine(mine.score, mine.hadOn ?? mine.createdAt, today) : null} first={i === 0} onPress={() => onPick({ itemId: d.id, name: d.name, barId: bar.id })} />;
            })}
          </View>
          {!shown.length ? <Caption tone="muted">{`Nothing called “${query.trim()}” on ${now.name}.`}</Caption> : null}
        </View>
      ) : null}
    </SheetScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.lg },
  section: { gap: space.xs },
});
