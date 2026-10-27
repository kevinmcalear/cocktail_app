import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { lazy, Suspense, type ReactElement } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Body, Button, Display, RowScore, scoreWords, useDs } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { DrinkLoading } from '@/components/screens/drink/DrinkLoading';
import { radius, space } from '@/constants/tokens';
import { useCocktail } from '@/hooks/useCocktails';
import { useItemScores } from '@/hooks/useFlavor';
import { useMineFacts } from '@/hooks/useMineFacts';
import { useStudyPile } from '@/hooks/useStudyPile';
import { useItemEditAccess } from '@/hooks/useViewAs';
import { withAlpha } from '@/lib/color';
import { heroPicture } from '@/lib/itemImages';
import { fallbackGlass, itemHref, type ItemCategory } from '@/lib/itemRoutes';
import { drinkFacts } from '@/lib/searchCaptions';
import type { SearchItem } from '@/types/search';

// The drink pane (and the animation code its scroll header runs on) loads when a
// drink is first picked, not with the Library.
const DrinkScreen = lazy(() => import('@/components/screens/drink/DrinkScreen').then((m) => ({ default: m.DrinkScreen })));


/** The list pane's width, as the tablet board draws it. */
const LIST_WIDTH = 360;

/** The picked drink's page, beside the list. Opening it full (or editing) goes to its own page. */
function DrinkPane({ id }: { id: string }) {
  const router = useRouter();
  const { toggleStudyPile, isInStudyPile } = useStudyPile();
  const query = useCocktail(id, { seeded: true });
  const drink = query.isPlaceholderData ? undefined : query.data;
  const editAccess = useItemEditAccess(drink);
  if (!drink) return <DrinkLoading seed={query.isPlaceholderData ? query.data : null} />;
  return (
    <Suspense fallback={<DrinkLoading seed={drink} />}>
      <DrinkScreen
        pane
        item={drink}
        inStudyPile={isInStudyPile(drink.id)}
        onToggleStudyPile={() => toggleStudyPile(drink.id)}
        canEdit={editAccess === 'edit'}
        adminFix={editAccess === 'admin'}
        onEdit={() => router.push(`/cocktail/${drink.id}/edit` as Href)}
        onFit={() => router.push(`/cocktail/${drink.id}/edit?fit=1` as Href)}
      />
    </Suspense>
  );
}

/** Not a drink (an ingredient, a beer): its name and a way to its own page. */
function OtherPane({ item }: { item: SearchItem }) {
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
 * tablet board draws it. Each drink row says why it's here ("On the Autumn
 * menu", "Classics 2 · off menu", a Past pill) and ends with its score, as
 * search's rows do. The pick lives in the URL (?pick=<id>), so a link opens
 * the same drink; with none, the first one shows.
 */
export function LibraryPanes({ venueId, items, lineOf, header, empty, footer }: { venueId: string | null; items: SearchItem[]; lineOf?: (item: SearchItem) => string | null; header: ReactElement; empty: ReactElement | null; footer?: ReactElement | null }) {
  const ds = useDs();
  const router = useRouter();
  const { pick } = useLocalSearchParams<{ pick?: string }>();
  const picked = items.find((i) => i.id === pick) ?? items[0] ?? null;
  const facts = useMineFacts(venueId, items);
  const { data: scores } = useItemScores(items.filter((i) => i.category === 'Cocktail').map((i) => i.id));
  // Drinks at a venue say why they're here; elsewhere (and other kinds) keep the tile's line.
  const why = (i: SearchItem) => (venueId && i.category === 'Cocktail' ? drinkFacts(i.id, i.category, facts, true) : { caption: lineOf?.(i) ?? i.category ?? undefined, tag: undefined });
  return (
    <View style={styles.row}>
      <FlatList
        style={[styles.list, { borderRightColor: ds.c.line }]}
        contentContainerStyle={styles.listBody}
        data={items}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={header}
        ListEmptyComponent={empty ?? undefined}
        ListFooterComponent={footer ?? undefined}
        renderItem={({ item }) => {
          const { caption, tag } = why(item);
          const score = scores?.[item.id];
          const said = scoreWords(score);
          return (
            <View style={[styles.pick, item.id === picked?.id && { backgroundColor: withAlpha(ds.accentText, 0.12) }]}>
              <DrinkRow
                name={item.name}
                imageUrl={heroPicture(item.item_images ?? [])?.url ?? null}
                glass={fallbackGlass(item.category as ItemCategory)}
                itemId={item.id}
                caption={caption}
                tag={tag}
                trailing={<RowScore score={score} />}
                label={said ? [item.name, caption, tag, said].filter(Boolean).join('. ') : undefined}
                onPress={() => router.setParams({ pick: item.id })}
              />
            </View>
          );
        }}
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
