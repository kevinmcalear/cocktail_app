import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Caption, useBreakpoint, useDs } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { OfflineNote, SavedChip } from '@/components/screens/home/OfflineParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';
import { useMineSearch } from '@/hooks/useMineSearch';
import type { SearchMine } from '@/hooks/useSearchMine';
import { heroPicture } from '@/lib/itemImages';
import { fallbackGlass, type ItemCategory } from '@/lib/itemRoutes';
import { openSearchItem } from '@/lib/openSearchItem';
import type { SearchItem } from '@/types/search';

import { ResultRow } from './ResultRows';

/**
 * Search offline (Sta-discover): "Searching this phone", what's saved on it
 * that matches (your place's drinks, house-mades and bottles, kept from the
 * last time they loaded), and what comes back with a connection.
 */
export function SearchOffline({ query, mine }: { query: string; mine: SearchMine }) {
  const ds = useDs();
  const router = useRouter();
  const phone = useBreakpoint() === 'phone';
  const q = query.trim();
  const { groups } = useMineSearch(mine, q);
  const open = (item: SearchItem) => openSearchItem(item, (href) => router.push(href as never));
  const where = phone ? 'phone' : 'device';
  const chevron = <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />;
  const found = groups.drinks.length + groups.ingredients.length + groups.menus.length;
  return (
    <View style={styles.page}>
      <SavedChip label={`Searching this ${where}`} />
      <View>
        {groups.drinks.map((i) => (
          <DrinkRow key={i.id} name={i.name} itemId={i.id} imageUrl={i.image?.uri ?? heroPicture(i.item_images)?.url ?? null} glass={fallbackGlass(i.category as ItemCategory)} caption={i.isDraft ? 'Draft' : mine.label} query={q} trailing={chevron} onPress={() => open(i)} />
        ))}
        {groups.ingredients.map((i) => (
          <ResultRow key={i.id} title={i.name} caption={mine.label} ingredient={{ id: i.isDraft ? null : i.id }} query={q} trailing={chevron} onPress={() => open(i)} />
        ))}
        {groups.menus.map((i) => (
          <ResultRow key={i.id} title={i.name} caption={mine.label} icon="list.bullet" query={q} trailing={chevron} onPress={() => open(i)} />
        ))}
      </View>
      {found ? null : <Caption tone="muted">{`Nothing on this ${where} called “${q}”.`}</Caption>}
      <OfflineNote text="Bars and people come back with a connection." />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: space.md },
});
