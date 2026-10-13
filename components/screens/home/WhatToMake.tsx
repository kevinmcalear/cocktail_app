import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Body, Button, Caption, Field, FieldButton, Headline, Segmented, useBreakpoint } from '@/components/ds';
import { Eyebrow } from '@/components/screens/addDrink/WizardChrome';
import { space } from '@/constants/tokens';
import { MAKE_PAGE, searchCaption, type Found, type MakeSearchRowData, type MakeTab } from '@/lib/myBarRows';
import { footLine, tabIntro } from '@/lib/myBarText';

/** What to make's search: what's typed, and how far each section of results is shown. */
export function useMakeSearch() {
  const [query, setQuery] = useState('');
  const [shownIn, setShownIn] = useState<Partial<Record<Found, number>>>({});
  return {
    query,
    shownIn,
    onQuery: (q: string) => {
      setQuery(q);
      setShownIn({});
    },
    onMore: (section: Found) => setShownIn((s) => ({ ...s, [section]: (s[section] ?? MAKE_PAGE) + MAKE_PAGE })),
  };
}

/**
 * What the shelf makes now, and what one or two more bottles would open,
 * grouped by what to buy. Only drinks the shelf gets close to: everything
 * else is in Search. This is the heading, the search box and the tabs; the
 * drinks and groups are rows of My Bar's list (MakeDrink, BottleGroup), then
 * MakeFoot. While searching, one line saying what matched takes the tabs' place
 * (`found`, from lib/myBarRows.ts).
 */
export function MakeHead({
  tab,
  onTab,
  counts,
  bottles,
  search,
  found,
  children,
}: {
  tab: MakeTab;
  onTab: (tab: MakeTab) => void;
  counts: { ready: number; first: number; one: number; two: number; projects?: number };
  /** Bottles on the shelf, for the line under the heading. */
  bottles: number;
  search: { query: string; onQuery: (query: string) => void };
  found?: Record<Found, number>;
  /** Under the tabs: the desktop's Make first strip on Ready. */
  children?: ReactNode;
}) {
  // A phone scrolls the tabs sideways; wider screens wrap them, as the desktop board draws.
  const phone = useBreakpoint() === 'phone';
  const options: { value: MakeTab; label: string }[] = [{ value: 'ready', label: `Ready · ${counts.ready}` }];
  if (counts.first) options.push({ value: 'first', label: `Make first · ${counts.first}` });
  options.push(
    { value: 'one', label: `One away · ${counts.one}` },
    { value: 'two', label: `Two away · ${counts.two}` },
  );
  // Projects only once there's kit or a lab shelf: a beginner's tabs stay three.
  if (counts.projects !== undefined) options.push({ value: 'projects', label: `Projects · ${counts.projects}` });
  return (
    <View style={styles.section}>
      <View style={styles.title}>
        <Headline role="heading">What to make</Headline>
        <Caption tone="muted">{`From your ${bottles} ${bottles === 1 ? 'bottle' : 'bottles'} and your pantry. Nothing here needs a trip to the shop unless it says so.`}</Caption>
      </View>
      <Field
        label="Search what you can make"
        hideLabel
        value={search.query}
        onChangeText={search.onQuery}
        placeholder="A drink, or a bottle you want to use"
        icon="magnifyingglass"
        inputMode="search"
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        trailing={search.query ? <FieldButton icon="xmark.circle.fill" label="Clear search" onPress={() => search.onQuery('')} /> : null}
      />
      {found ? (
        <Caption tone="muted" aria-live="polite">
          {searchCaption(search.query, found)}
        </Caption>
      ) : (
        <>
          {phone ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Segmented accessibilityLabel="What to make" value={tab} onChange={onTab} options={options} />
            </ScrollView>
          ) : (
            <Segmented accessibilityLabel="What to make" value={tab} onChange={onTab} options={options} />
          )}
          {tabIntro(tab) ? <Caption tone="muted">{tabIntro(tab)}</Caption> : null}
          {children}
        </>
      )}
    </View>
  );
}

/** A tab with nothing in it, and where to look instead. */
export function MakeEmpty({ tab, oneAway }: { tab: MakeTab; oneAway: number }) {
  return (
    <Body tone="muted">
      {tab === 'ready'
        ? `Nothing yet. ${oneAway ? 'See what one more bottle would open.' : 'Add a few bottles and what’s in your kitchen.'}`
        : tab === 'one'
          ? 'No drink is one bottle away yet.'
          : tab === 'two'
            ? 'No drink is two bottles away yet.'
            : tab === 'first'
              ? 'Nothing to make first: every drink you can make uses what’s on your bar.'
              : 'No technique fits your kit and lab shelf yet. Add what you have.'}
    </Body>
  );
}

const SECTION: Record<Found, string> = { ready: 'Ready', one: 'One bottle away', two: 'Two bottles away' };

/** A search's own rows: each section's title, its "Show more", and the line when nothing matches. */
export function MakeSearchRow({ row, onMore }: { row: MakeSearchRowData; onMore: (section: Found) => void }) {
  if (row.kind === 'make-heading') {
    return (
      <View role="heading" style={styles.heading}>
        <Eyebrow>{SECTION[row.section]}</Eyebrow>
      </View>
    );
  }
  if (row.kind === 'make-more') {
    return <Button label={`Show more (${row.more})`} accessibilityLabel={`Show ${row.more} more: ${SECTION[row.section]}`} variant="ghost" onPress={() => onMore(row.section)} />;
  }
  return <Body tone="muted">No drink you can make, or nearly make, matches “{row.query}”.</Body>;
}

/**
 * "Show more" while there are, then the way to every other drink: under a
 * search, the search itself carried over ("Search every drink for “rye”").
 * Under a search it holds a screen's height, so fewer results don't pull the
 * list up and slide the search box under the keyboard.
 */
export function MakeFoot({ more, tab, query, onMore }: { more: number; tab: MakeTab; query?: string; onMore: () => void }) {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const q = query?.trim();
  return (
    <View style={[styles.foot, q ? { minHeight: height } : null]}>
      {more > 0 ? <Button label={`Show more (${more})`} variant="ghost" onPress={onMore} /> : null}
      <View style={styles.more}>
        {q ? <Caption tone="muted">{`Want a ${q} drink you’re further from?`}</Caption> : <Caption tone="muted">{footLine(tab)}</Caption>}
        <Button
          label={q ? `Search every drink for “${q}”` : 'Search every drink'}
          icon="magnifyingglass"
          variant={q ? 'secondary' : 'ghost'}
          onPress={() => router.push((q ? `/search?q=${encodeURIComponent(q)}` : '/search') as never)}
        />
        {q ? <Caption tone="muted">{footLine('ready')}</Caption> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md, paddingBottom: space.md },
  title: { gap: 2 },
  heading: { paddingTop: space.lg, paddingBottom: space.xs },
  foot: { gap: space.md, paddingTop: space.md },
  more: { gap: space.sm, alignItems: 'flex-start', paddingTop: space.md },
});
