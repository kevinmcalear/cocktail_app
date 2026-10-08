import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Title } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { space } from '@/constants/tokens';
import { useSearchCatalog } from '@/hooks/useSearchCatalog';
import type { SearchMine } from '@/hooks/useSearchMine';
import { heroPicture } from '@/lib/itemImages';
import { fallbackGlass, type ItemCategory } from '@/lib/itemRoutes';
import { openSearchItem } from '@/lib/openSearchItem';
import { groupCatalog } from '@/lib/searchScope';
import { capitalize } from '@/lib/stringUtils';
import type { SearchItem } from '@/types/search';

import { ResultGroup, ResultRow } from './ResultRows';

interface MineResultsProps {
  query: string;
  mine: SearchMine;
  onEverywhere: () => void;
}

/** The venue's library (or your own drinks) matching the query: drinks, ingredients and menus. */
export function MineResults({ query, mine, onEverywhere }: MineResultsProps) {
  const router = useRouter();
  const { items, isLoading } = useSearchCatalog(mine.contextIds);
  const groups = useMemo(() => groupCatalog(items, query), [items, query]);
  const q = query.trim();
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
      </View>
    );
  }

  return (
    <View style={styles.results}>
      <ResultGroup
        label="Drinks"
        items={groups.drinks}
        render={(i) => (
          <DrinkRow
            key={i.id}
            name={capitalize(i.name)}
            itemId={i.id}
            imageUrl={i.image?.uri ?? heroPicture(i.item_images)?.url ?? null}
            glass={fallbackGlass(i.category as ItemCategory)}
            caption={i.isDraft ? 'Draft' : i.category === 'Cocktail' ? undefined : i.category}
            onPress={() => open(i)}
          />
        )}
      />
      <ResultGroup label="Ingredients" items={groups.ingredients} render={(i) => <ResultRow key={i.id} title={capitalize(i.name)} caption={i.isDraft ? 'Draft' : undefined} ingredient={{ id: i.isDraft ? null : i.id }} onPress={() => open(i)} />} />
      <ResultGroup label="Menus" items={groups.menus} render={(i) => <ResultRow key={i.id} title={i.name} caption={i.isDraft ? 'Draft' : undefined} icon="list.bullet" onPress={() => open(i)} />} />
      {everywhere}
    </View>
  );
}

const styles = StyleSheet.create({
  results: { gap: space.lg },
  none: { gap: space.md, paddingTop: space.lg },
});
