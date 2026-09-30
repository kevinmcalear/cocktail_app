import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Chip, Title } from '@/components/ds';
import { AreaRankList, EarlyList, ListNote } from '@/components/screens/rankings/RankingLists';
import { space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useDiscoverRankings, useDrinkLists } from '@/hooks/useDiscover';
import { findDrinks } from '@/lib/discover';
import { itemHref } from '@/lib/itemRoutes';
import { areaLabel, type Area } from '@/lib/nearMe';
import { MIN_RANKERS } from '@/lib/ranking';

import { ChipRow } from './DiscoverArea';

// Enough chips to scan in one swipe; the search finds the rest.
const MAX_CHIPS = 12;

/**
 * Which drink "Best ..." is about: the best match for what's typed in
 * Discover's search (or the classic of the style picked), else a tapped chip.
 * Shared by the list and the map, so both show the same drink.
 */
export function useDrinkPick(hint: string) {
  const lists = useDrinkLists();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const all = lists.data ?? [];
  const matches = findDrinks(all, hint);
  // A search that names no classic ("gin") keeps the usual chips.
  const shown = (matches.length ? matches : all).slice(0, MAX_CHIPS);
  // Typing moves the pick to the best match, unless the pick still matches.
  const drink = shown.find((d) => d.id === pickedId) ?? shown[0] ?? null;
  return { lists, setPickedId, shown, drink };
}

export type DrinkPick = ReturnType<typeof useDrinkPick>;

/**
 * "Best Martini near you": pick a drink (Discover's search or the chips) and see the bars
 * whose version people ranked highest in the area. Each row is one drink at
 * one bar, as in the brief. Below the ranker minimum the list is "Early":
 * where people are ranking it, without scores.
 */
export function DiscoverBest({ area, pick }: { area: Area; pick: DrinkPick }) {
  const router = useRouter();
  const signedIn = !!useAuth().user;
  const { lists, setPickedId, shown, drink } = pick;
  const where = areaLabel(area);
  const best = useDiscoverRankings(drink?.id ?? null, area);
  const ranked = best.data?.ranked ?? [];
  const early = best.data?.early ?? [];

  if (!lists.isLoading && !lists.data?.length) {
    return <ListNote>{signedIn ? 'No drinks to rank yet.' : 'Sign in to find the best drinks near you.'}</ListNote>;
  }

  let results;
  if (best.error) results = <ListNote>{`Couldn't load the rankings: ${best.error.message}`}</ListNote>;
  else if (best.isLoading) results = <ListNote>Loading…</ListNote>;
  else if (ranked.length) results = <AreaRankList rows={ranked} />;
  else if (early.length) {
    results = (
      <>
        <ListNote>{`Too few rankings to call a best yet. People have started ranking it at these bars; a score shows once ${MIN_RANKERS} people rank a bar's.`}</ListNote>
        <EarlyList rows={early} />
      </>
    );
  } else results = <ListNote>{`Nobody has ranked a ${drink?.name ?? 'drink'} at a bar ${where} yet.`}</ListNote>;

  return (
    <View style={styles.section}>
      <ChipRow label="Drink">
        {shown.map((d) => (
          <Chip key={d.id} label={d.name} selected={d.id === drink?.id} onPress={() => setPickedId(d.id)} />
        ))}
      </ChipRow>
      {drink ? (
        <View style={styles.results}>
          <Caption tone="muted">{ranked.length || best.isLoading ? 'Ranked by comparison' : early.length ? 'Early' : 'Not ranked yet'}</Caption>
          <Title role="heading">{ranked.length || best.isLoading ? `Best ${drink.name} ${where}` : `${drink.name} ${where}`}</Title>
          {results}
          {signedIn && !ranked.length && !best.isLoading ? (
            <Button label={`Rank a ${drink.name} you've had`} variant="secondary" onPress={() => router.push(itemHref('Cocktail', drink.id) as never)} />
          ) : null}
          <Button label={`All ${drink.name} rankings and your list`} variant="ghost" onPress={() => router.push(`/rankings/${drink.id}`)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  results: { gap: space.sm, marginTop: space.md },
});
