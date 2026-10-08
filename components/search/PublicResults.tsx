import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Chip } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { ChipRow } from '@/components/screens/home/DiscoverArea';
import { ListNote } from '@/components/screens/rankings/RankingLists';
import { space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useDrinkLists } from '@/hooks/useDiscover';
import { useDiscoverResults } from '@/hooks/useDiscoverDrinks';
import { useDropdowns } from '@/hooks/useDropdowns';
import { usePublicPeople } from '@/hooks/useProfiles';
import { usePublicBars } from '@/hooks/useRankings';
import { findDrinks } from '@/lib/discover';
import { barInArea, findBars, type DiscoverBar } from '@/lib/discoverDrinks';
import { findKinds } from '@/lib/drinkStyles';
import { itemHref } from '@/lib/itemRoutes';
import { areaLabel, type Area } from '@/lib/nearMe';

import { ResultGroup, ResultRow } from './ResultRows';

const ANYWHERE: Area = { kind: 'anywhere' };
const place = (parts: (string | null | undefined)[]) => parts.filter(Boolean).join(', ');

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
  const signedIn = !!useAuth().user;
  const q = query.trim();
  const everywhere = !area;
  const where = areaLabel(area ?? ANYWHERE);
  const results = useDiscoverResults({ kinds: [...kinds], search: q, area: area ?? ANYWHERE });
  const { data: publicBars } = usePublicBars(everywhere && !signedIn ? q : '');
  const { data: people } = usePublicPeople(everywhere ? q : '');
  const { data: classicList } = useDrinkLists();
  const { data: dropdowns } = useDropdowns();

  const bars = useMemo((): DiscoverBar[] => {
    if (signedIn) return findBars(area ? results.bars.filter((b) => barInArea(b, area)) : results.bars, q);
    return (publicBars ?? []).map((b) => ({ id: b.id, handle: '', name: b.display_name, logo: null, locality: b.locality, city: b.city, countryCode: b.country_code, latitude: null, longitude: null }));
  }, [signedIn, area, results.bars, publicBars, q]);
  const classics = useMemo(() => (everywhere && classicList ? findDrinks(classicList, q) : []), [everywhere, classicList, q]);
  const ingredients = useMemo(
    () => (everywhere && dropdowns ? findDrinks((dropdowns.ingredients as { id: string; name: string; bar_id: string | null }[]).filter((i) => !i.bar_id), q) : []),
    [everywhere, dropdowns, q]
  );
  const found = results.drinks.length + bars.length + (people?.length ?? 0) + classics.length + ingredients.length;
  const named = onKind ? findKinds(q) : [];

  return (
    <View style={styles.results}>
      {named.length ? (
        <ChipRow label="Browse">
          {named.map((k) => (
            <Chip key={k.id} label={k.label} selected={false} onPress={() => onKind?.(k.id)} />
          ))}
        </ChipRow>
      ) : null}
      {!signedIn ? <ListNote>Sign in to search the drinks bars pour.</ListNote> : null}
      <ResultGroup
        label={`Drinks ${area ? where : 'at bars'}`}
        items={results.drinks}
        render={(d) => {
          const bar = results.barsById.get(d.barId);
          return (
            <DrinkRow
              key={d.id}
              name={d.name}
              href={itemHref('Cocktail', d.id)}
              itemId={d.id}
              imageUrl={d.imageUrl}
              glass={null}
              caption={bar ? [bar.name, place([bar.locality, bar.city]), d.menu?.onNow ? 'on now' : null].filter(Boolean).join(' · ') : undefined}
              logo={bar ? { uri: bar.logo, name: bar.name } : undefined}
              tag={d.menu?.past ?? undefined}
            />
          );
        }}
      />
      <ResultGroup
        label={`Bars ${area ? where : ''}`.trim()}
        items={bars}
        render={(b) => <ResultRow key={b.id} title={b.name} caption={place([b.locality, b.city])} avatar={{ uri: b.logo }} onPress={() => router.push(`/p/${b.handle || b.id}`)} />}
      />
      <ResultGroup
        label="People"
        items={everywhere ? (people ?? []) : []}
        render={(p) => <ResultRow key={p.id} title={p.display_name} caption={p.city ?? undefined} avatar={{ uri: null }} onPress={() => router.push(`/p/${p.handle || p.id}`)} />}
      />
      <ResultGroup
        label="Classics"
        items={classics}
        render={(d) => <DrinkRow key={d.id} name={d.name} href={itemHref('Cocktail', d.id)} itemId={d.id} imageUrl={d.imageUrl} glass={null} caption="Classic" />}
      />
      <ResultGroup label="Ingredients" items={ingredients} render={(i) => <ResultRow key={i.id} title={i.name} icon="drop.fill" onPress={() => router.push(itemHref('Ingredient', i.id) as never)} />} />
      {!found && signedIn ? <Caption tone="muted">{results.isLoading ? 'Searching…' : `Nothing ${where} called “${q}”.`}</Caption> : null}
      {area && onEverywhere ? <Button label={`Search everywhere for “${q}”`} variant="secondary" onPress={onEverywhere} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  results: { gap: space.lg },
});
