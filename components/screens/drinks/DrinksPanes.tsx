import { useLocalSearchParams, usePathname, useRouter, type Href } from 'expo-router';
import { lazy, Suspense, type ReactElement } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Body, Button, Display, useDs } from '@/components/ds';
import { DrinkListRow, type DrinkListRowProps } from '@/components/screens/drinks/DrinksParts';
import { DrinkLoading } from '@/components/screens/drink/DrinkLoading';
import { layout, space } from '@/constants/tokens';
import { useCocktail } from '@/hooks/useCocktails';
import { useOpenBeside } from '@/hooks/useDrinksSplit';
import { useItemEditAccess } from '@/hooks/useViewAs';
import { itemHref, type ItemCategory } from '@/lib/itemRoutes';
import type { SearchItem } from '@/types/search';

// The drink pane (and the animation code its scroll header runs on) loads when a
// drink is first picked, not with the list.
const DrinkScreen = lazy(() => import('@/components/screens/drink/DrinkScreen').then((m) => ({ default: m.DrinkScreen })));


/** The picked drink's page, beside the list. Opening it full (or editing) goes to its own page. */
export function DrinkPane({ id }: { id: string }) {
  const router = useRouter();
  const query = useCocktail(id, { seeded: true });
  const drink = query.isPlaceholderData ? undefined : query.data;
  const editAccess = useItemEditAccess(drink);
  if (!drink) return <DrinkLoading seed={query.isPlaceholderData ? query.data : null} />;
  return (
    <Suspense fallback={<DrinkLoading seed={drink} />}>
      <DrinkScreen
        pane
        item={drink}
        canEdit={editAccess === 'edit'}
        adminFix={editAccess === 'admin'}
        onEdit={() => router.push(`/cocktail/${drink.id}/edit` as Href)}
      />
    </Suspense>
  );
}

/** Not a drink (an ingredient, a beer): its name and a way to its own page. */
export function OtherPane({ item }: { item: SearchItem }) {
  const router = useRouter();
  return (
    <View style={styles.other}>
      <Display>{item.name}</Display>
      <Button label={`Open ${item.name}`} variant="secondary" onPress={() => router.push(itemHref(item.category as ItemCategory, item.id) as never)} />
    </View>
  );
}

/**
 * The Drinks tab on a tablet (768 to 1199 wide, beside the rail): the list
 * with its head and chips on the left, the picked drink's page on the right,
 * as the canvas's tablet board draws it. The rows are the phone's
 * (DrinkListRow, `rowOf`). The pick lives in the URL (?pick=<id>), so a link
 * opens the same drink; with none, the first one shows.
 *
 * `routed` (a desktop, hooks/useDrinksSplit.ts; Sta-capsules-desk): the list
 * alone, in its column beside the Drinks stack; a drink opens there at its
 * own URL (/cocktail/<id>) and its row stays lit. At /drinks the stack shows
 * the list's first row (components/nav/NoDrinkPicked.tsx), so that one is lit
 * while the list isn't `filtered` by what's typed in its search.
 */
export function DrinksPanes({ items, rowOf, header, empty, footer, routed = false, filtered = false }: { items: SearchItem[]; rowOf: (item: SearchItem) => Omit<DrinkListRowProps, 'onPress' | 'picked'>; header: ReactElement; empty: ReactElement | null; footer?: ReactElement | null; routed?: boolean; filtered?: boolean }) {
  const ds = useDs();
  const router = useRouter();
  const { pick } = useLocalSearchParams<{ pick?: string }>();
  const beside = useOpenBeside();
  const atRoot = usePathname() === '/drinks';
  const picked = routed ? (items.find((i) => i.id === beside.picked) ?? (atRoot && !filtered ? (items[0] ?? null) : null)) : (items.find((i) => i.id === pick) ?? items[0] ?? null);
  const list = (
    <FlatList
      style={routed ? styles.fill : [styles.list, { borderRightColor: ds.c.line }]}
      contentContainerStyle={styles.listBody}
      data={items}
      keyExtractor={(i) => i.id}
      ListHeaderComponent={header}
      ListEmptyComponent={empty ?? undefined}
      ListFooterComponent={footer ?? undefined}
      renderItem={({ item }) => (
        <DrinkListRow
          {...rowOf(item)}
          picked={item.id === picked?.id}
          onPress={() => (routed ? beside.open(itemHref(item.category as ItemCategory, item.id)) : router.setParams({ pick: item.id }))}
        />
      )}
    />
  );
  if (routed) return list;
  return (
    <View style={styles.row}>
      {list}
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
  fill: { flex: 1 },
  list: { width: layout.listPane, flexGrow: 0, flexShrink: 0, borderRightWidth: StyleSheet.hairlineWidth },
  listBody: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: space.xs },
  detail: { flex: 1, minWidth: 0 },
  other: { padding: space.xxl, gap: space.lg },
});
