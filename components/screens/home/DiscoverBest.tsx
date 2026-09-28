import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Chip, Field, Title } from '@/components/ds';
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
 * "Best Martini near you": pick a drink (search or chips) and see the bars
 * whose version people ranked highest in the area. Each row is one drink at
 * one bar, as in the brief. Below the ranker minimum the list is "Early":
 * where people are ranking it, without scores.
 */
export function DiscoverBest({ area }: { area: Area }) {
  const router = useRouter();
  const signedIn = !!useAuth().user;
  const lists = useDrinkLists();
  const [search, setSearch] = useState('');
  const [pickedId, setPickedId] = useState<string | null>(null);

  const shown = findDrinks(lists.data ?? [], search).slice(0, MAX_CHIPS);
  // Typing moves the pick to the best match, unless the pick still matches.
  const drink = shown.find((d) => d.id === pickedId) ?? shown[0] ?? null;
  const where = areaLabel(area);
  const best = useDiscoverRankings(drink?.id, area);
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
      <Field
        label="Find a drink"
        value={search}
        onChangeText={setSearch}
        placeholder="Martini, Negroni, Paper Plane"
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
      <ChipRow label="Drink">
        {shown.map((d) => (
          <Chip key={d.id} label={d.name} selected={d.id === drink?.id} onPress={() => setPickedId(d.id)} />
        ))}
      </ChipRow>
      {search.trim() && !shown.length ? <ListNote>{`No drink called "${search.trim()}" yet.`}</ListNote> : null}

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
