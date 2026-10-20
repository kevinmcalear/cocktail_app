import { getLocales } from 'expo-localization';
import { useRouter } from 'expo-router';
import { isValidElement, useEffect, useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, RowScore } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { DrinkAtBarRow } from '@/components/screens/home/DrinksAtBars';
import { ListNote } from '@/components/screens/rankings/RankingLists';
import { space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import { useRowScores } from '@/hooks/useBestDrink';
import { useBarCities, useDrinkLists, useDrinkPick } from '@/hooks/useDiscover';
import { useDiscoverBars, useDiscoverResults } from '@/hooks/useDiscoverDrinks';
import { useDrinkLines } from '@/hooks/useDrinkSources';
import { useItemScores } from '@/hooks/useFlavor';
import { usePublicIngredientSearch } from '@/hooks/useIngredients';
import { usePublicPeople } from '@/hooks/useProfiles';
import { usePublicBars } from '@/hooks/useRankings';
import { useSearchCatalog } from '@/hooks/useSearchCatalog';
import type { SearchMine } from '@/hooks/useSearchMine';
import { useSpecMatches } from '@/hooks/useSpecMatches';
import { countryName } from '@/lib/countries';
import { findCities, findDrinks, foldName, type City } from '@/lib/discover';
import { barInArea, distanceKm, findBars, type DiscoverBar } from '@/lib/discoverDrinks';
import { isStrong } from '@/lib/discoverMatch';
import { findKinds, kindCaption, STYLES } from '@/lib/drinkStyles';
import { heroPicture } from '@/lib/itemImages';
import { fallbackGlass, itemHref, type ItemCategory } from '@/lib/itemRoutes';
import { areaLabel, formatDistance, usesMiles, type Area } from '@/lib/nearMe';
import { openSearchItem } from '@/lib/openSearchItem';
import { completions, groupCatalog, shows, type SearchShow, type ShowCounts } from '@/lib/searchScope';
import { foldIntoClassics, gatherVariations } from '@/lib/servedAt';
import { capitalize } from '@/lib/stringUtils';

import { BrowseChips, ClassicRow, StyleCard } from './ClassicRow';
import { BarResultRow, ResultGroup, ResultRow } from './ResultRows';
import { Completions, TopHit } from './SearchParts';

const ANYWHERE: Area = { kind: 'anywhere' };
const NO_IDS: string[] = [];

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
  /** Whose search it is: a venue's (classics lead) or someone at home (bars lead, then their own drinks). */
  mine?: SearchMine;
  /** The type chips' pick. */
  show?: SearchShow;
  /** Hears how many of each kind were found, for the type chips. */
  onCounts?: (counts: ShowCounts) => void;
  /** The search tab: finishes the typed word, and puts a classic named that first as a Top hit. */
  typeAhead?: (query: string) => void;
  /** Discover: a city the search names moves the area there. Elsewhere it opens Discover on it. */
  onPlace?: (city: City) => void;
}

/**
 * Bars and the drinks they pour, here or everywhere. Everywhere adds the
 * bartenders, the classics (each with its bars' variations gathered under
 * it), your own drinks at home, and the ingredients. Every drink and bar row
 * ends with its score (b02) and lights the searched word. Bars' drinks need
 * an account; the rest is public.
 */
export function PublicResults({ query, area, kinds = [], onKind, onEverywhere, mine, show, onCounts, typeAhead, onPlace }: PublicResultsProps) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const q = query.trim();
  const everywhere = !area;
  const where = areaLabel(area ?? ANYWHERE);
  // Discover lights the word with a tint; the search page in the accent.
  const look = onKind ? 'tint' : 'accent';
  const atHome = !mine?.venueId;
  const results = useDiscoverResults({ kinds: [...kinds], search: q, area: area ?? ANYWHERE });
  // The search page's bar rows count what the search matched and what's on now ("Fitzroy · 14 drinks on now").
  const { data: searchedBars } = useDiscoverBars(area ?? ANYWHERE, { kinds, search: q, onNow: true }, signedIn && !onKind && q.length > 1);
  const { data: publicBars } = usePublicBars(everywhere && !signedIn ? q : '');
  const { data: people } = usePublicPeople(everywhere ? q : '');
  const { data: classicList } = useDrinkLists();
  const { data: ingredientHits } = usePublicIngredientSearch(everywhere ? q : '');
  const pick = useDrinkPick(q);
  // Places first, as a map search reads them: "New York" is the city before any bar called New York (Kevin, 16 Oct).
  const { data: cities } = useBarCities();
  const places = useMemo(() => (cities ? findCities(cities, q) : []), [cities, q]);
  const openPlace = (c: City) => (onPlace ? onPlace(c) : router.push({ pathname: '/discover', params: { city: c.city, cc: c.country_code } }));
  const scores = useRowScores(results.drinks, area ?? ANYWHERE, signedIn);
  // At home, Everywhere also finds your own drinks.
  const catalog = useSearchCatalog(everywhere && atHome && signedIn && mine ? mine.contextIds : NO_IDS);
  const yours = useMemo(() => (everywhere && atHome ? groupCatalog(catalog.items, q).drinks : []), [everywhere, atHome, catalog.items, q]);

  const bars = useMemo((): DiscoverBar[] => {
    const all = searchedBars ?? results.bars;
    if (signedIn) return findBars(area ? all.filter((b) => barInArea(b, area)) : all, q);
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
  }, [signedIn, area, searchedBars, results.bars, publicBars, q]);
  const classics = useMemo(() => (everywhere && classicList ? findDrinks(classicList, q) : []), [everywhere, classicList, q]);
  const ingredients = useMemo(() => (everywhere && ingredientHits ? findDrinks(ingredientHits, q) : []), [everywhere, ingredientHits, q]);
  // A bar's copy of a classic in these results folds into it ("served at 7 bars"); its variations gather under it.
  const { data: matches } = useSpecMatches(signedIn && q ? `search:${q}` : undefined, results.drinks.map((d) => d.id));
  const { drinks, servedBy, variations } = useMemo(() => {
    const ids = new Set(classics.map((c) => c.id));
    const folded = foldIntoClassics(results.drinks, ids, (id) => matches?.[id]);
    return { servedBy: folded.servedBy, ...gatherVariations(folded.drinks, ids, (id) => matches?.[id]) };
  }, [results.drinks, classics, matches]);
  const shownClassics = classics.slice(0, 10).map((c) => c.id);
  const { data: lines } = useDrinkLines(shownClassics);
  const { data: ownScores } = useItemScores([...shownClassics, ...yours.slice(0, 20).map((i) => i.id)]);

  const found = (shows(show, 'bars') ? places.length : 0) + drinks.length + bars.length + (people?.length ?? 0) + classics.length + ingredients.length + yours.length;
  const countKey = JSON.stringify({ drinks: drinks.length + classics.length + yours.length, bars: bars.length, people: people?.length ?? 0, ingredients: ingredients.length });
  useEffect(() => {
    onCounts?.(JSON.parse(countKey) as ShowCounts);
  }, [countKey, onCounts]);
  // The search tab: a classic whose name starts with what's typed leads, bigger (search-typing).
  const top = typeAhead && !onKind && shows(show, 'drinks') ? classics.find((c) => foldName(c.name).startsWith(foldName(q))) : undefined;
  const finish = typeAhead && !onKind ? completions([...classics, ...drinks, ...bars, ...ingredients].map((d) => d.name), q) : [];
  const named = findKinds(q);
  const style = named.find((k) => STYLES.some((s) => s.id === k.id));
  const strong = drinks.filter((d) => isStrong(d.match));
  const weak = drinks.filter((d) => !isStrong(d.match));
  const miles = usesMiles(getLocales()[0]);
  const away = (b: DiscoverBar) => (area?.kind === 'point' && b.latitude !== null && b.longitude !== null ? formatDistance(distanceKm(area, { latitude: b.latitude, longitude: b.longitude }), miles) : null);

  const drinkGroup = (label: string, list: typeof drinks) => (
    <ResultGroup key={label} label={label} items={list} render={(d) => <DrinkAtBarRow key={d.id} drink={d} scores={scores} query={q} matchLook={look} everywhere={everywhere && !onKind} />} />
  );
  const barGroup = (
    <ResultGroup
      key="bars"
      label={`Bars ${area ? where : ''}`.trim()}
      items={bars}
      render={(b) => <BarResultRow key={b.id} bar={b} score={scores.bars[b.id]?.score} away={away(b)} query={q} matchLook={look} />}
    />
  );
  const placeGroup = (
    <ResultGroup
      key="places"
      label="Places"
      items={places}
      render={(c) => (
        <ResultRow
          key={`${c.city}|${c.country_code}`}
          title={c.label}
          caption={`${countryName(c.country_code)} · ${c.bars} ${c.bars === 1 ? 'bar' : 'bars'}`}
          icon="mappin.and.ellipse"
          query={q}
          matchLook={look}
          onPress={() => openPlace(c)}
        />
      )}
    />
  );
  const peopleGroup = (
    <ResultGroup
      key="people"
      label="People"
      items={everywhere ? (people ?? []) : []}
      render={(p) => <ResultRow key={p.id} title={p.display_name} caption={p.job ?? p.city ?? undefined} avatar={{ uri: null }} query={q} matchLook={look} onPress={() => router.push(`/p/${p.handle || p.id}`)} />}
    />
  );
  const classicGroup = (
    <ResultGroup
      key="classics"
      label="Classics"
      items={top ? classics.filter((c) => c !== top) : classics}
      render={(d) => <ClassicRow key={d.id} classic={d} line={lines?.[d.id]} served={servedBy[d.id]} variations={variations[d.id]} matches={matches} score={ownScores?.[d.id]} scores={scores} query={q} matchLook={look} />}
    />
  );
  const yoursGroup = (
    <ResultGroup
      key="yours"
      label="Your drinks"
      items={yours}
      render={(i) => {
        const line = (i.recipes ?? []).map((r) => r.ingredient?.name?.toLowerCase()).filter(Boolean).slice(0, 3).join(', ');
        return (
          <DrinkRow
            key={i.id}
            name={i.name}
            itemId={i.id}
            imageUrl={i.image?.uri ?? heroPicture(i.item_images)?.url ?? null}
            glass={fallbackGlass(i.category as ItemCategory)}
            caption={[i.isDraft ? 'Draft' : 'Yours', line || null].filter(Boolean).join(' · ')}
            query={q}
            matchLook={look}
            trailing={<RowScore score={ownScores?.[i.id]} />}
            onPress={() => openSearchItem(i, (href) => router.push(href as never))}
          />
        );
      }}
    />
  );
  const alsoGroup = drinkGroup(`Also mentions “${q}”`, weak);
  const ingredientGroup = (
    <ResultGroup key="ingredients" label="Ingredients" items={ingredients} render={(i) => <ResultRow key={i.id} title={i.name} ingredient={{ id: i.id }} query={q} matchLook={look} onPress={() => router.push(itemHref('Ingredient', i.id) as never)} />} />
  );

  // Each door's order, as its board draws it.
  let groups: ReactNode[];
  if (onKind && area) {
    // Discover: named, then riffs, then the weaker matches, then the bars (disc-search-typing).
    const word = capitalize(q.toLowerCase());
    groups = [drinkGroup(`Named ${word}`, strong.filter((d) => d.match?.kind !== 'riff')), drinkGroup(`Riffs on a ${word}`, strong.filter((d) => d.match?.kind === 'riff')), alsoGroup, barGroup];
  } else if (atHome) {
    groups = [barGroup, peopleGroup, drinkGroup(`Drinks ${area ? where : 'at bars'}`, strong), classicGroup, yoursGroup, alsoGroup, ingredientGroup];
  } else {
    groups = [classicGroup, drinkGroup(`Drinks ${area ? where : 'at bars'}`, strong), alsoGroup, barGroup, peopleGroup, ingredientGroup];
  }

  // A bar named what's typed ("Black Pearl") leads, ahead of drinks that only mention it.
  if (bars[0] && foldName(bars[0].name).startsWith(foldName(q))) groups = [barGroup, ...groups.filter((g) => g !== barGroup)];

  // The type chips narrow the groups to one kind.
  const kindOf: Record<string, 'bars' | 'people' | 'ingredients'> = { bars: 'bars', people: 'people', ingredients: 'ingredients' };
  const shown = groups.filter((g) => shows(show, (isValidElement(g) && g.key ? kindOf[g.key] : undefined) ?? 'drinks'));

  return (
    <View style={styles.results}>
      {typeAhead ? <Completions query={q} names={finish} onPick={typeAhead} /> : null}
      {/* A place the search names leads everything, as a map search reads it. */}
      {shows(show, 'bars') ? placeGroup : null}
      {top ? (
        <TopHit
          name={top.name}
          itemId={top.id}
          imageUrl={top.imageUrl}
          glass={null}
          caption={['Classic', servedBy[top.id]?.length ? `served at ${servedBy[top.id].length} ${servedBy[top.id].length === 1 ? 'bar' : 'bars'}` : null].filter(Boolean).join(' · ')}
          line={lines?.[top.id]}
          score={ownScores?.[top.id]}
          query={q}
          onPress={() => router.push(itemHref('Cocktail', top.id) as never)}
        />
      ) : null}
      {/* "martini" offers the Martinis style first on Discover; elsewhere a Browse line with the style and the ingredient. */}
      {onKind && style ? (
        <StyleCard label={style.label} count={strong.length} where={where} takesIn={styleTakesIn(style.id)} drawingId={pick?.id} onPress={() => onKind(style.id)} />
      ) : everywhere ? (
        <BrowseChips style={style} ingredient={ingredients.find((i) => foldName(i.name).startsWith(foldName(q)))} />
      ) : null}
      {/* A spirit or a tasting note the search names becomes a filter on Discover. */}
      <ResultGroup label="Filter by" items={onKind ? named.filter((k) => k !== style) : []} render={(k) => <ResultRow key={k.id} title={k.label} caption={kindCaption(k.id)} icon="line.3.horizontal.decrease" onPress={() => onKind?.(k.id)} />} />
      {!signedIn ? <ListNote>Sign in to search the drinks bars pour.</ListNote> : null}
      {shown}
      {!found && signedIn ? <Caption tone="muted">{results.isLoading ? 'Searching…' : `Nothing ${where} called “${q}”.`}</Caption> : null}
      {area && onEverywhere ? <Button label={`Search everywhere for “${q}”`} variant="secondary" onPress={onEverywhere} /> : null}
    </View>
  );
}

/** "Gibsons, Vespers and riffs too": what a style takes in besides its name. */
function styleTakesIn(id: string): string {
  const rest = STYLES.find((s) => s.id === id)?.classics.slice(1, 3) ?? [];
  return rest.length ? `${rest.map((c) => (c.endsWith('s') ? c : `${c}s`)).join(', ')} and riffs too` : 'and its riffs too';
}

const styles = StyleSheet.create({
  results: { gap: space.lg },
});
