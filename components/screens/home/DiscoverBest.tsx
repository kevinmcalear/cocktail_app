import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, Caption, Chip, Field, Title } from '@/components/ds';
import { AreaRankList, ListNote } from '@/components/screens/rankings/RankingLists';
import { space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useBarCities, useDrinkLists } from '@/hooks/useDiscover';
import { useDrinkRankings } from '@/hooks/useRankings';
import { findDrinks } from '@/lib/discover';
import { itemHref } from '@/lib/itemRoutes';
import { MIN_RANKERS } from '@/lib/ranking';

// Enough chips to scan in one swipe; the search finds the rest.
const MAX_CHIPS = 12;

/** A row of chips that scrolls sideways instead of wrapping. */
function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      <View role="radiogroup" accessibilityLabel={label} style={styles.chips}>
        {children}
      </View>
    </ScrollView>
  );
}

/**
 * "Best Martini in New York": pick a drink (search or chips) and a city, and
 * see the bars whose version people ranked highest. Each row is one drink at
 * one bar, as in the brief. "Near me" comes with bar coordinates.
 */
export function DiscoverBest() {
  const router = useRouter();
  const signedIn = !!useAuth().user;
  const lists = useDrinkLists();
  const { data: cities } = useBarCities();
  const [search, setSearch] = useState('');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [cityKey, setCityKey] = useState<string | null>(null);

  const shown = findDrinks(lists.data ?? [], search).slice(0, MAX_CHIPS);
  // Typing moves the pick to the best match, unless the pick still matches.
  const drink = shown.find((d) => d.id === pickedId) ?? shown[0] ?? null;
  const keyOf = (c: { city: string; country_code: string }) => `${c.city}|${c.country_code}`;
  const city = cities?.find((c) => keyOf(c) === cityKey) ?? null;
  const area: Record<string, string> = city ? { p_city: city.city, p_country_code: city.country_code } : {};
  const where = city ? `in ${city.label}` : 'anywhere';
  const best = useDrinkRankings(drink?.id, area);

  if (!lists.isLoading && !lists.data?.length) {
    return <ListNote>{signedIn ? 'No drinks to rank yet.' : 'Sign in to find the best drinks near you.'}</ListNote>;
  }

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
      {cities?.length ? (
        <ChipRow label="Where">
          <Chip label="Anywhere" selected={!city} onPress={() => setCityKey(null)} />
          {cities.map((c) => (
            <Chip key={keyOf(c)} label={c.label} selected={keyOf(c) === cityKey} onPress={() => setCityKey(keyOf(c))} />
          ))}
        </ChipRow>
      ) : null}

      {drink ? (
        <View style={styles.results}>
          <Caption tone="muted">Ranked by comparison</Caption>
          <Title role="heading">{`Best ${drink.name} ${where}`}</Title>
          {best.error ? (
            <ListNote>{`Couldn't load the rankings: ${best.error.message}`}</ListNote>
          ) : best.isLoading ? (
            <ListNote>Loading…</ListNote>
          ) : best.data?.length ? (
            <AreaRankList rows={best.data} />
          ) : (
            <>
              <ListNote>{`No ${drink.name} has enough rankers ${where} yet. A bar's shows here once ${MIN_RANKERS} people have ranked it.`}</ListNote>
              {signedIn ? (
                <Button label={`Rank a ${drink.name} you've had`} variant="secondary" onPress={() => router.push(itemHref('Cocktail', drink.id) as never)} />
              ) : null}
            </>
          )}
          <Button label={`All ${drink.name} rankings and your list`} variant="ghost" onPress={() => router.push(`/rankings/${drink.id}`)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  chips: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  results: { gap: space.sm, marginTop: space.md },
});
