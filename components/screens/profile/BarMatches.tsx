import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, RowScore, scoreWords, Surface } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { ListNote } from '@/components/screens/rankings/RankingLists';
import { space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import { useDrinkRank } from '@/hooks/useBestDrink';
import { useDiscoverList } from '@/hooks/useDiscoverDrinks';
import { drinkCount, type DiscoverDrink } from '@/lib/discoverDrinks';
import { itemHref } from '@/lib/itemRoutes';
import type { Area } from '@/lib/nearMe';

const ANYWHERE: Area = { kind: 'anywhere' };

/**
 * A bar's page opened from a Discover search (/p/<bar>?q=martini): the
 * drinks here that match come first, each saying why when the name doesn't,
 * so nobody scrolls the menu hunting for the one they tapped. Close shows
 * the page as usual. Nothing without a search, or signed out (bars' drinks
 * need an account).
 */
export function BarMatches({ barProfileId }: { barProfileId: string }) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const query = typeof q === 'string' ? q.trim() : '';
  const list = useDiscoverList({ kinds: [], search: query, area: ANYWHERE }, { barId: barProfileId, enabled: signedIn && !!query });
  if (!query || !signedIn) return null;
  return (
    <Surface raised style={styles.block}>
      <View style={styles.head}>
        <Caption tone="muted" role="heading" style={styles.flex}>
          {list.drinks.length ? `For “${query}” · ${drinkCount(list.totals?.drinks ?? list.drinks.length)} here` : `For “${query}”`}
        </Caption>
        <Button label="Whole menu" icon="xmark" variant="ghost" accessibilityLabel={`Stop showing matches for ${query}`} onPress={() => router.setParams({ q: undefined })} />
      </View>
      {list.isLoading ? (
        <ListNote>Loading…</ListNote>
      ) : list.drinks.length ? (
        <View role="list">
          {list.drinks.map((d) => (
            <BarMatchRow key={d.id} drink={d} query={query} />
          ))}
        </View>
      ) : (
        <ListNote>{`Nothing here matches “${query}”.`}</ListNote>
      )}
    </Surface>
  );
}

/** A match at this bar: on now, where it ranks, why it matched (the word lit), and its score at the end (b02). */
function BarMatchRow({ drink: d, query }: { drink: DiscoverDrink; query: string }) {
  const rank = useDrinkRank(d, query, ANYWHERE);
  const caption = [d.menu.onNow ? 'On now' : null, rank.caption].filter(Boolean).join(' · ') || undefined;
  const note = (d.why ?? d.description) || undefined;
  const said = scoreWords(rank.score);
  return (
    <DrinkRow
      name={d.name}
      href={itemHref('Cocktail', d.id)}
      itemId={d.id}
      imageUrl={d.imageUrl}
      glass={null}
      caption={caption}
      tag={d.menu.past ?? undefined}
      note={note}
      query={query}
      matchLook="tint"
      trailing={<RowScore score={rank.score} />}
      label={said ? [d.name, caption, d.menu.past, said, note].filter(Boolean).join('. ') : undefined}
    />
  );
}

const styles = StyleSheet.create({
  block: { gap: space.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
});
