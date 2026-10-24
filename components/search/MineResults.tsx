import { useRouter } from 'expo-router';
import { useEffect, useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, RowScore, scoreWords } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { space } from '@/constants/tokens';
import { useItemScores } from '@/hooks/useFlavor';
import { useMineFacts } from '@/hooks/useMineFacts';
import { usePublicPeople, useWaiting } from '@/hooks/useProfiles';
import { useSearchCatalog } from '@/hooks/useSearchCatalog';
import type { SearchMine } from '@/hooks/useSearchMine';
import { foldName } from '@/lib/discover';
import { heroPicture } from '@/lib/itemImages';
import { fallbackGlass, newDrinkHref, type ItemCategory } from '@/lib/itemRoutes';
import { itemIdOf } from '@/lib/libraryFilters';
import { openSearchItem } from '@/lib/openSearchItem';
import { drinkFacts, ingredientFacts, menuFacts } from '@/lib/searchCaptions';
import { completions, groupCatalog, shows, type SearchShow, type ShowCounts } from '@/lib/searchScope';
import { capitalize } from '@/lib/stringUtils';
import type { SearchItem } from '@/types/search';

import { PublicResults } from './PublicResults';
import { EverywhereRow, MissCard, PersonResultRow, ResultGroup, ResultRow } from './ResultRows';
import { Completions, TopHit } from './SearchParts';

interface MineResultsProps {
  query: string;
  mine: SearchMine;
  onEverywhere: () => void;
  /** The ⌘K palette's Commands group, after the results. */
  commands?: ReactNode;
  /** In the ⌘K palette: Search everywhere is a slim row. */
  palette?: boolean;
  /** The type chips' pick. */
  show?: SearchShow;
  /** Hears how many of each kind were found, for the type chips. */
  onCounts?: (counts: ShowCounts) => void;
  /** The search tab: finishes the typed word, and puts the best match first as a Top hit. */
  typeAhead?: (query: string) => void;
}

/** A drink's ingredients in spec order: "gin, Campari, sweet vermouth". */
export const specLine = (i: SearchItem) =>
  (i.recipes ?? [])
    .map((r) => r.ingredient?.name)
    .filter(Boolean)
    .slice(0, 4)
    .join(', ');

/**
 * The venue's library (or your own drinks) matching the query: drinks, each
 * saying why it's here and ending with its score, ingredients and menus, the
 * word lit in the accent. Nothing found says so in one line and shows what
 * Everywhere has right under it (search-miss).
 */
export function MineResults({ query, mine, onEverywhere, commands, palette, show, onCounts, typeAhead }: MineResultsProps) {
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
  const open = (item: SearchItem) => openSearchItem(item, (href) => router.push(href as never));
  const found = groups.drinks.length + groups.ingredients.length + groups.menus.length;
  // Bartenders show in this scope too (find-yourself); Everywhere's results bring their own when nothing is here.
  const { data: people = [] } = usePublicPeople(found ? q : '');
  const { data: waiting } = useWaiting([], people.map((p) => p.id));

  // The best match leads, bigger, when its name starts with what's typed (or it's the only drink).
  const top = typeAhead && shows(show, 'drinks') ? (groups.drinks.find((i) => foldName(i.name).startsWith(foldName(q))) ?? (groups.drinks.length === 1 ? groups.drinks[0] : undefined)) : undefined;
  const drinks = top ? groups.drinks.filter((i) => i !== top) : groups.drinks;
  const finish = typeAhead ? completions([...groups.drinks, ...groups.ingredients, ...groups.menus].map((i) => i.name), q) : [];

  // Nothing here: Everywhere's results below report their own.
  const countKey = found ? JSON.stringify({ drinks: groups.drinks.length, ingredients: groups.ingredients.length, menus: groups.menus.length, people: people.length }) : null;
  useEffect(() => {
    if (countKey) onCounts?.(JSON.parse(countKey) as ShowCounts);
  }, [countKey, onCounts]);

  if (!found) {
    if (isLoading) return <Caption tone="muted">Searching…</Caption>;
    const where = mine.venueId ? mine.label : 'your drinks';
    const add = () => router.push(newDrinkHref(capitalize(q), mine.venueId) as never);
    return (
      <View style={styles.results}>
        <MissCard
          title={`Nothing ${mine.venueId ? `at ${mine.label}` : 'in your drinks'} called “${q}”`}
          detail="Here’s what everywhere else has."
          action={mine.canAdd ? { label: `Add ${capitalize(q)} to ${where}`, onPress: add } : undefined}
        />
        <PublicResults query={q} area={null} mine={mine} show={show} onCounts={onCounts} />
        {commands}
      </View>
    );
  }

  const label = `Search everywhere for “${q}”`;
  const everywhere = palette ? <EverywhereRow label={label} onPress={onEverywhere} /> : <Button label={label} variant="secondary" onPress={onEverywhere} />;
  const drinkRow = (i: SearchItem) => {
    const why = i.isDraft ? { caption: 'Draft' } : drinkFacts(i.id, i.category ?? 'Cocktail', facts);
    const score = i.isDraft ? undefined : scores?.[i.id];
    const said = scoreWords(score);
    return (
      <DrinkRow
        key={i.id}
        name={i.name}
        itemId={i.id}
        imageUrl={i.image?.uri ?? heroPicture(i.item_images)?.url ?? null}
        glass={fallbackGlass(i.category as ItemCategory)}
        caption={why.caption}
        tag={why.tag}
        query={q}
        trailing={<RowScore score={score} />}
        label={said ? [i.name, why.caption, why.tag, said].filter(Boolean).join('. ') : undefined}
        onPress={() => open(i)}
      />
    );
  };

  return (
    <View style={styles.results}>
      {typeAhead ? <Completions query={q} names={finish} onPick={typeAhead} /> : null}
      {top ? (
        <TopHit
          name={top.name}
          itemId={top.id}
          imageUrl={top.image?.uri ?? heroPicture(top.item_images)?.url ?? null}
          glass={fallbackGlass(top.category as ItemCategory)}
          caption={top.isDraft ? 'Draft' : drinkFacts(top.id, top.category ?? 'Cocktail', facts).caption}
          line={specLine(top) || undefined}
          score={top.isDraft ? undefined : scores?.[top.id]}
          query={q}
          onPress={() => open(top)}
        />
      ) : null}
      {shows(show, 'drinks') ? <ResultGroup label="Drinks" items={drinks} render={drinkRow} /> : null}
      {shows(show, 'ingredients') ? (
        <ResultGroup
          label="Ingredients"
          items={groups.ingredients}
          render={(i) => <ResultRow key={i.id} title={i.name} caption={i.isDraft ? 'Draft' : ingredientFacts(i.id, facts)} ingredient={{ id: i.isDraft ? null : i.id }} query={q} onPress={() => open(i)} />}
        />
      ) : null}
      {shows(show, 'menus') ? (
        <ResultGroup
          label="Menus"
          items={groups.menus}
          render={(i) => <ResultRow key={i.id} title={i.name} caption={i.isDraft ? 'Draft' : menuFacts(i.id.replace(/^menu-/, ''), drinkIds, facts)} icon="list.bullet" query={q} onPress={() => open(i)} />}
        />
      ) : null}
      {shows(show, 'people') ? <ResultGroup label="People" items={people} render={(p) => <PersonResultRow key={p.id} person={p} waiting={waiting?.[p.id]} query={q} />} /> : null}
      {commands}
      {everywhere}
    </View>
  );
}

const styles = StyleSheet.create({
  results: { gap: space.lg },
});
