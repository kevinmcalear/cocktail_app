import { useNetInfo } from '@react-native-community/netinfo';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useState, type ReactNode } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';

import { Caption, Chip, useDs, useGutter } from '@/components/ds';
import { PencilState } from '@/components/ds/PencilState';
import { usePageColumn } from '@/components/nav/pageColumn';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { WebHead } from '@/components/WebHead';
import { FilterRow } from '@/components/screens/library/LibraryChips';
import { space } from '@/constants/tokens';
import { useCollection } from '@/hooks/useCollection';
import { useDrinkLines } from '@/hooks/useDrinkLines';
import { useMyBar } from '@/hooks/useHomeBar';
import { useMyHadDrinks } from '@/hooks/useRankings';
import { useOpenSearch } from '@/hooks/useSearchFrom';
import { homeReach, needLine } from '@/lib/shelfReach';
import { HOME_CAPSULES, HOME_CHIPS, homeCapsule, homeRows, type HomeCapsule, type HomeChip } from '@/lib/drinksTab';
import { ingredientLine, sentenceLine } from '@/lib/menus';

import { DrinkListRow, DrinksHead, DrinksLoading } from './DrinksParts';

// The shelf (My Bar) and the menus each load when their capsule is picked.
const Shelf = lazy(() => import('./HomeMenus').then((m) => ({ default: m.MyBarScreen })));
const Menus = lazy(() => import('./HomeMenus').then((m) => ({ default: m.HomeMenus })));

/** What each chip says with nothing in it, and where it sends you. */
const EMPTY: Record<HomeChip, { title: string; action?: string }> = {
  make: { title: 'Nothing you can make yet. Tell us what’s on your shelf.', action: 'Go to your shelf' },
  saved: { title: 'No saved drinks yet. Save one from any drink and it’s here.' },
  ranked: { title: 'No ranks yet. Rank your first drink tonight and your list starts here.', action: 'Rank a drink' },
  sours: { title: 'No sours among your drinks yet.' },
  stirred: { title: 'Nothing stirred among your drinks yet.' },
};

/**
 * The Drinks tab at home (Prod-phone drinks and shelf, home): Home over
 * Drinks, the capsule (Drinks, Shelf, Menus; ?tab=shelf opens the shelf).
 * Drinks: the chips (Can make, Saved, Ranked, Sours, Stirred) and a row per
 * drink, its ingredients under its name and Ready or what it needs on the
 * right. Shelf is My Bar under this head; Menus are your menus and the bars'.
 */
export function HomeDrinks() {
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const capsule = homeCapsule(tab);
  const gutter = useGutter();
  const offline = useNetInfo().isConnected === false;
  const head = (
    <DrinksHead eyebrow="Home" capsules={HOME_CAPSULES} value={capsule} onChange={(c: HomeCapsule) => router.setParams({ tab: c === 'drinks' ? undefined : c })} offline={offline ? 'Saved on this phone · offline' : null} bleed={gutter} />
  );
  const title = (
    <WebHead>
      <title>Drinks</title>
    </WebHead>
  );
  if (capsule === 'shelf')
    return (
      <Suspense fallback={<Page>{head}</Page>}>
        {title}
        <Shelf head={head} />
      </Suspense>
    );
  if (capsule === 'menus')
    return (
      <Page>
        {title}
        {head}
        <Suspense fallback={<DrinksLoading />}>
          <Menus />
        </Suspense>
      </Page>
    );
  return (
    <>
      {title}
      <HomeList head={head} />
    </>
  );
}

/** A page in the column, under the head (Menus, and the shelf while it loads). */
function Page({ children }: { children: ReactNode }) {
  const ds = useDs();
  const bottom = useTabBarInset();
  const column = usePageColumn('wide');
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={[column, styles.page, { paddingBottom: bottom + space.lg }]}>{children}</ScrollView>
    </View>
  );
}

/** Home Drinks' list: the chips, then a row per drink. */
function HomeList({ head }: { head: ReactNode }) {
  const ds = useDs();
  const gutter = useGutter();
  const offline = useNetInfo().isConnected === false;
  const router = useRouter();
  const openSearch = useOpenSearch();
  const client = useQueryClient();
  const bottom = useTabBarInset();
  const column = usePageColumn('text');
  const [chip, setChip] = useState<HomeChip>('make');
  const bar = useMyBar();
  const collection = useCollection();
  const had = useMyHadDrinks();
  const src = {
    make: [...bar.canMake, ...bar.oneAway.flatMap((g) => g.drinks)],
    saved: (collection.data?.drinks ?? []).flatMap((d) => (d.itemId ? [{ id: d.itemId, name: d.name }] : [])),
    ranked: (had.data ?? []).map((d) => ({ id: d.itemId, name: d.name })),
  };
  const styled = chip === 'sours' || chip === 'stirred';
  // Every drink's lines for the style chips; the list's own otherwise.
  const ids = (styled ? [...src.make, ...src.saved, ...src.ranked] : src[chip]).map((d) => d.id);
  const lines = useDrinkLines(ids);
  const rows = homeRows(chip, src, (id) => lines.data?.[id]);
  // Each chip waits on its own list; the style chips on every list and the drinks' lines.
  const loading = chip === 'make' ? bar.isLoading : chip === 'saved' ? collection.isLoading : chip === 'ranked' ? had.isLoading : bar.isLoading || collection.isLoading || had.isLoading || lines.isLoading;
  const failed = { make: !!bar.error && !src.make.length, saved: !!collection.error && !collection.data, ranked: !!had.error && !had.data, sours: false, stirred: false }[chip];
  const empty = EMPTY[chip];
  const end = (id: string) => {
    const reach = homeReach(id, bar);
    if (reach.kind === 'ready') return { text: 'Ready', tone: 'ready' as const };
    return reach.kind === 'far' ? null : { text: needLine(reach.need), tone: 'warn' as const };
  };
  const top = (
    <View style={styles.top}>
      {head}
      <FilterRow label="Which drinks" gutter={gutter} groups={[HOME_CHIPS.map((c) => <Chip key={c.value} label={c.label} selected={chip === c.value} onPress={() => setChip(c.value)} />)]} />
    </View>
  );
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <FlatList
        data={loading || failed ? [] : rows}
        keyExtractor={(d) => d.id}
        contentContainerStyle={[column, styles.list, { paddingBottom: bottom + space.lg }]}
        ListHeaderComponent={top}
        renderItem={({ item }) => {
          const reading = lines.data?.[item.id]?.reading ?? [];
          return <DrinkListRow itemId={item.id} name={item.name} line={reading.length ? sentenceLine(ingredientLine(reading)) : null} end={end(item.id)} onPress={() => router.push(`/cocktail/${item.id}` as Href)} />;
        }}
        ListEmptyComponent={
          failed ? (
            <PencilState kind="error" title="Your drinks didn’t load" detail="The connection dropped halfway." action={{ label: 'Try again', onPress: () => void client.refetchQueries({ type: 'active' }) }} />
          ) : loading ? (
            <DrinksLoading />
          ) : (
            <PencilState kind="empty" title={empty.title} action={empty.action ? { label: empty.action, onPress: () => (chip === 'make' ? router.setParams({ tab: 'shelf' }) : openSearch()) } : undefined} />
          )
        }
        ListFooterComponent={offline && rows.length ? <Caption tone="muted">Search works offline too.</Caption> : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { gap: space.xl },
  top: { gap: space.md, paddingBottom: space.sm },
  list: { gap: space.xs },
});
