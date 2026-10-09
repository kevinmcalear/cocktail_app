import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { ListNote } from '@/components/screens/rankings/RankingLists';
import { space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import { useDrinkLists } from '@/hooks/useDiscover';
import { useDiscoverResults } from '@/hooks/useDiscoverDrinks';
import { usePublicIngredientSearch } from '@/hooks/useIngredients';
import { usePublicPeople } from '@/hooks/useProfiles';
import { usePublicBars } from '@/hooks/useRankings';
import { useSpecMatches } from '@/hooks/useSpecMatches';
import { findDrinks } from '@/lib/discover';
import { barInArea, findBars, type DiscoverBar, type DiscoverDrink } from '@/lib/discoverDrinks';
import { isStrong } from '@/lib/discoverMatch';
import { findKinds, kindCaption } from '@/lib/drinkStyles';
import { itemHref } from '@/lib/itemRoutes';
import { areaLabel, type Area } from '@/lib/nearMe';
import { foldIntoClassics, servedCaption, versionLabel } from '@/lib/servedAt';

import { BarResultRow, ResultGroup, ResultRow } from './ResultRows';

const ANYWHERE: Area = { kind: 'anywhere' };
const place = (parts: (string | null | undefined)[]) => parts.filter(Boolean).join(', ');

/**
 * A drink at a bar: the bar and where under the name, what it is to its classic
 * ("the classic spec", or what its variation changes), and why it matched when the name doesn't say.
 */
function drinkRow(d: DiscoverDrink, version?: string) {
  const bar = d.bar;
  return (
    <DrinkRow
      key={d.id}
      name={d.name}
      href={itemHref('Cocktail', d.id)}
      itemId={d.id}
      imageUrl={d.imageUrl}
      glass={null}
      caption={[bar.name, place([bar.locality, bar.city]), version, d.menu.onNow ? 'on now' : null].filter(Boolean).join(' · ')}
      logo={{ uri: bar.logo, name: bar.name }}
      tag={d.menu.past ?? undefined}
      note={d.why ?? undefined}
    />
  );
}

interface PublicResultsProps {
  query: string;
  /** Discover's area: only bars and drinks in it. Null searches everywhere. */
  area: Area | null;
  /** Discover's picked styles, spirits and notes, which narrow the drinks too. */
  kinds?: readonly string[];
  /** On Discover: a style or spirit the search names becomes a filter. */
  onKind?: (kind: string) => void;
  /** In an area: the button that widens the search. */
  onEverywhere?: () => void;
}

/**
 * Bars and the drinks they pour, here or everywhere. Everywhere adds the
 * bartenders, the classics and the ingredients. Bars' drinks need an account;
 * the rest is public.
 */
export function PublicResults({ query, area, kinds = [], onKind, onEverywhere }: PublicResultsProps) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const q = query.trim();
  const everywhere = !area;
  const where = areaLabel(area ?? ANYWHERE);
  const results = useDiscoverResults({ kinds: [...kinds], search: q, area: area ?? ANYWHERE });
  const { data: publicBars } = usePublicBars(everywhere && !signedIn ? q : '');
  const { data: people } = usePublicPeople(everywhere ? q : '');
  const { data: classicList } = useDrinkLists();
  const { data: ingredientHits } = usePublicIngredientSearch(everywhere ? q : '');

  const bars = useMemo((): DiscoverBar[] => {
    if (signedIn) return findBars(area ? results.bars.filter((b) => barInArea(b, area)) : results.bars, q);
    return (publicBars ?? []).map((b) => ({
      id: b.id,
      handle: '',
      name: b.display_name,
      logo: null,
      locality: b.locality,
      city: b.city,
      countryCode: b.country_code,
      latitude: null,
      longitude: null,
      closed: !!b.is_closed,
      closedYear: b.closed_year ?? null,
      drinks: 0,
    }));
  }, [signedIn, area, results.bars, publicBars, q]);
  const classics = useMemo(() => (everywhere && classicList ? findDrinks(classicList, q) : []), [everywhere, classicList, q]);
  const ingredients = useMemo(() => (everywhere && ingredientHits ? findDrinks(ingredientHits, q) : []), [everywhere, ingredientHits, q]);
  // A bar's copy of a classic in these results folds into it: "Classic · Served at The Gold Room +2".
  const { data: matches } = useSpecMatches(signedIn && q ? `search:${q}` : undefined, results.drinks.map((d) => d.id));
  const { drinks, servedBy } = useMemo(
    () => foldIntoClassics(results.drinks, new Set(classics.map((c) => c.id)), (id) => matches?.[id]),
    [results.drinks, classics, matches]
  );
  const found = drinks.length + bars.length + (people?.length ?? 0) + classics.length + ingredients.length;
  const named = onKind ? findKinds(q) : [];
  const strong = drinks.filter((d) => isStrong(d.match));
  const weak = drinks.filter((d) => !isStrong(d.match));

  return (
    <View style={styles.results}>
      {/* "martini" offers the Martinis style first: riffs, Gibsons and Vespers, not every drink that says martini. */}
      <ResultGroup label="Styles" items={named} render={(k) => <ResultRow key={k.id} title={k.label} caption={kindCaption(k.id)} icon="line.3.horizontal.decrease" onPress={() => onKind?.(k.id)} />} />
      {!signedIn ? <ListNote>Sign in to search the drinks bars pour.</ListNote> : null}
      <ResultGroup label={`Drinks ${area ? where : 'at bars'}`} items={strong} render={(d) => drinkRow(d, versionLabel(matches?.[d.id]))} />
      <ResultGroup
        label={`Bars ${area ? where : ''}`.trim()}
        items={bars}
        render={(b) => <BarResultRow key={b.id} bar={b} />}
      />
      <ResultGroup
        label="People"
        items={everywhere ? (people ?? []) : []}
        render={(p) => <ResultRow key={p.id} title={p.display_name} caption={p.city ?? undefined} avatar={{ uri: null }} onPress={() => router.push(`/p/${p.handle || p.id}`)} />}
      />
      <ResultGroup
        label="Classics"
        items={classics}
        render={(d) => {
          const served = servedBy[d.id];
          const caption = ['Classic', served ? servedCaption(served.length, served) : null].filter(Boolean).join(' · ');
          return <DrinkRow key={d.id} name={d.name} href={itemHref('Cocktail', d.id)} itemId={d.id} imageUrl={d.imageUrl} glass={null} caption={caption} />;
        }}
      />
      {/* Weaker matches last, each saying why: "Has Martini Rosso", the description around the word. */}
      <ResultGroup label={`Also mentions “${q}”`} items={weak} render={(d) => drinkRow(d, versionLabel(matches?.[d.id]))} />
      <ResultGroup label="Ingredients" items={ingredients} render={(i) => <ResultRow key={i.id} title={i.name} ingredient={{ id: i.id }} onPress={() => router.push(itemHref('Ingredient', i.id) as never)} />} />
      {!found && signedIn ? <Caption tone="muted">{results.isLoading ? 'Searching…' : `Nothing ${where} called “${q}”.`}</Caption> : null}
      {area && onEverywhere ? <Button label={`Search everywhere for “${q}”`} variant="secondary" onPress={onEverywhere} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  results: { gap: space.lg },
});
