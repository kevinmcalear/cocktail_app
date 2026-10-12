import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, RowScore, scoreWords, Title } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { space } from '@/constants/tokens';
import { useDrinkLists } from '@/hooks/useDiscover';
import { useDrinkLines } from '@/hooks/useDrinkSources';
import { useItemScores } from '@/hooks/useFlavor';
import { useMineFacts } from '@/hooks/useMineFacts';
import { useSearchCatalog } from '@/hooks/useSearchCatalog';
import type { SearchMine } from '@/hooks/useSearchMine';
import { findDrinks } from '@/lib/discover';
import { heroPicture } from '@/lib/itemImages';
import { fallbackGlass, type ItemCategory } from '@/lib/itemRoutes';
import { itemIdOf } from '@/lib/libraryFilters';
import { openSearchItem } from '@/lib/openSearchItem';
import { drinkFacts, ingredientFacts, menuFacts } from '@/lib/searchCaptions';
import { groupCatalog } from '@/lib/searchScope';
import { capitalize } from '@/lib/stringUtils';
import type { SearchItem } from '@/types/search';

import { ClassicRow } from './ClassicRow';
import { ResultGroup, ResultRow } from './ResultRows';

interface MineResultsProps {
  query: string;
  mine: SearchMine;
  onEverywhere: () => void;
}

/**
 * The venue's library (or your own drinks) matching the query: drinks, each
 * saying why it's here and ending with its score, ingredients and menus, the
 * word lit in the accent. Nothing found shows what Everywhere has.
 */
export function MineResults({ query, mine, onEverywhere }: MineResultsProps) {
  const router = useRouter();
  const { items: catalog, isLoading } = useSearchCatalog(mine.contextIds);
  const items = useMemo(() => {
    const hidden = new Set(mine.hiddenIds);
    return hidden.size ? catalog.filter((i) => !hidden.has(itemIdOf(i.id))) : catalog;
  }, [catalog, mine.hiddenIds]);
  const groups = useMemo(() => groupCatalog(items, query), [items, query]);
  const facts = useMineFacts(mine.venueId, items);
  const q = query.trim();
  const drinkIds = groups.drinks.filter((i) => !i.isDraft).map((i) => i.id);
  const { data: scores } = useItemScores(drinkIds.slice(0, 50));
  // Nothing here: the classics Everywhere has, as a preview (nav-search-none).
  const { data: classicList } = useDrinkLists();
  const elsewhere = useMemo(() => (classicList && q ? findDrinks(classicList, q).slice(0, 3) : []), [classicList, q]);
  const { data: lines } = useDrinkLines(elsewhere.map((c) => c.id));
  const { data: classicScores } = useItemScores(elsewhere.map((c) => c.id));
  const open = (item: SearchItem) => openSearchItem(item, (href) => router.push(href as never));
  const found = groups.drinks.length + groups.ingredients.length + groups.menus.length;
  const everywhere = <Button label={`Search everywhere for “${q}”`} variant={found ? 'secondary' : 'primary'} onPress={onEverywhere} />;

  if (!found) {
    if (isLoading) return <Caption tone="muted">Searching…</Caption>;
    const add = () => router.push(`/add-cocktail?name=${encodeURIComponent(capitalize(q))}${mine.venueId ? `&barId=${mine.venueId}` : ''}` as never);
    return (
      <View style={styles.none}>
        <Title role="heading">{`Nothing ${mine.venueId ? `at ${mine.label}` : 'in your drinks'} called “${q}”`}</Title>
        <Body tone="muted">{mine.canAdd ? 'Look for it at other bars and in the classics, or add it here.' : 'Look for it at other bars and in the classics.'}</Body>
        {everywhere}
        {mine.canAdd ? <Button label={`Add “${capitalize(q)}” to ${mine.venueId ? mine.label : 'your drinks'}`} variant="secondary" onPress={add} /> : null}
        <ResultGroup
          label={`Everywhere has ${elsewhere.length} ${elsewhere.length === 1 ? 'classic' : 'classics'}`}
          items={elsewhere}
          render={(c) => <ClassicRow key={c.id} classic={c} line={lines?.[c.id]} score={classicScores?.[c.id]} query={q} />}
        />
      </View>
    );
  }

  return (
    <View style={styles.results}>
      <ResultGroup
        label="Drinks"
        items={groups.drinks}
        render={(i) => {
          const why = i.isDraft ? { caption: 'Draft' } : drinkFacts(i.id, i.category ?? 'Cocktail', facts);
          const score = i.isDraft ? undefined : scores?.[i.id];
          const said = scoreWords(score);
          return (
            <DrinkRow
              key={i.id}
              name={capitalize(i.name)}
              itemId={i.id}
              imageUrl={i.image?.uri ?? heroPicture(i.item_images)?.url ?? null}
              glass={fallbackGlass(i.category as ItemCategory)}
              caption={why.caption}
              tag={why.tag}
              query={q}
              trailing={<RowScore score={score} />}
              label={said ? [capitalize(i.name), why.caption, why.tag, said].filter(Boolean).join('. ') : undefined}
              onPress={() => open(i)}
            />
          );
        }}
      />
      <ResultGroup
        label="Ingredients"
        items={groups.ingredients}
        render={(i) => <ResultRow key={i.id} title={capitalize(i.name)} caption={i.isDraft ? 'Draft' : ingredientFacts(i.id, facts)} ingredient={{ id: i.isDraft ? null : i.id }} query={q} onPress={() => open(i)} />}
      />
      <ResultGroup
        label="Menus"
        items={groups.menus}
        render={(i) => <ResultRow key={i.id} title={i.name} caption={i.isDraft ? 'Draft' : menuFacts(i.id.replace(/^menu-/, ''), drinkIds, facts)} icon="list.bullet" query={q} onPress={() => open(i)} />}
      />
      {everywhere}
    </View>
  );
}

const styles = StyleSheet.create({
  results: { gap: space.lg },
  none: { gap: space.md, paddingTop: space.lg },
});
