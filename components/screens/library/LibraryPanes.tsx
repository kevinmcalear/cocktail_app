import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import type { ReactElement } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Body, Button, Display, useDs } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { DrinkLoading, DrinkScreen } from '@/components/screens/drink/DrinkScreen';
import { radius, space } from '@/constants/tokens';
import { useCocktail } from '@/hooks/useCocktails';
import { useStudyPile } from '@/hooks/useStudyPile';
import { useCanEditItem } from '@/hooks/useViewAs';
import { withAlpha } from '@/lib/color';
import { heroPicture, type ItemImageLink } from '@/lib/itemImages';
import { fallbackGlass, itemHref, type ItemCategory } from '@/lib/itemRoutes';

/** What a Library row needs: the catalog's shape. */
export interface PaneItem {
  id: string;
  name: string;
  category?: string;
  item_images?: ItemImageLink[] | null;
}

/** The list pane's width, as the tablet board draws it. */
const LIST_WIDTH = 360;

/** The picked drink's page, beside the list. Opening it full (or editing) goes to its own page. */
function DrinkPane({ id }: { id: string }) {
  const router = useRouter();
  const { toggleStudyPile, isInStudyPile } = useStudyPile();
  const query = useCocktail(id, { seeded: true });
  const drink = query.isPlaceholderData ? undefined : query.data;
  const canEdit = useCanEditItem(drink);
  if (!drink) return <DrinkLoading seed={query.isPlaceholderData ? query.data : null} />;
  return (
    <DrinkScreen
      pane
      item={drink}
      inStudyPile={isInStudyPile(drink.id)}
      onToggleStudyPile={() => toggleStudyPile(drink.id)}
      canEdit={canEdit}
      onEdit={() => router.push(`/cocktail/${drink.id}/edit` as Href)}
    />
  );
}

/** Not a drink (an ingredient, a beer): its name and a way to its own page. */
function OtherPane({ item }: { item: PaneItem }) {
  const router = useRouter();
  return (
    <View style={styles.other}>
      <Display>{item.name}</Display>
      <Button label={`Open ${item.name}`} variant="secondary" onPress={() => router.push(itemHref(item.category as ItemCategory, item.id) as never)} />
    </View>
  );
}

/**
 * Library on a tablet (768 to 1199 wide, beside the rail): the list with its
 * filters on the left, the picked drink's page on the right, as the canvas's
 * tablet board draws it. The pick lives in the URL (?pick=<id>), so a link
 * opens the same drink; with none, the first one shows.
 */
export function LibraryPanes({ items, header, empty }: { items: PaneItem[]; header: ReactElement; empty: ReactElement | null }) {
  const ds = useDs();
  const router = useRouter();
  const { pick } = useLocalSearchParams<{ pick?: string }>();
  const picked = items.find((i) => i.id === pick) ?? items[0] ?? null;
  return (
    <View style={styles.row}>
      <FlatList
        style={[styles.list, { borderRightColor: ds.c.line }]}
        contentContainerStyle={styles.listBody}
        data={items}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={header}
        ListEmptyComponent={empty ?? undefined}
        renderItem={({ item }) => (
          <View style={[styles.pick, item.id === picked?.id && { backgroundColor: withAlpha(ds.accentText, 0.12) }]}>
            <DrinkRow
              name={item.name}
              imageUrl={heroPicture(item.item_images ?? [])?.url ?? null}
              glass={fallbackGlass(item.category as ItemCategory)}
              itemId={item.id}
              caption={item.category ?? undefined}
              onPress={() => router.setParams({ pick: item.id })}
            />
          </View>
        )}
      />
      <View style={styles.detail}>
        {!picked ? (
          <Body tone="muted" style={styles.other}>
            Pick a drink to see it here.
          </Body>
        ) : picked.category === 'Cocktail' ? (
          <DrinkPane key={picked.id} id={picked.id} />
        ) : (
          <OtherPane item={picked} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row' },
  list: { width: LIST_WIDTH, flexGrow: 0, flexShrink: 0, borderRightWidth: StyleSheet.hairlineWidth },
  listBody: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: space.xs },
  pick: { borderRadius: radius.control, paddingHorizontal: space.sm, marginHorizontal: -space.sm },
  detail: { flex: 1, minWidth: 0 },
  other: { padding: space.xxl, gap: space.lg },
});
