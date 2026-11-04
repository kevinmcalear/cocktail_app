import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Caption, Head, PencilState, useDs } from '@/components/ds';
import { ListNote, OutlineRows, SavedChip, SectionLabel } from '@/components/ds/ListGroup';
import { usePageColumn } from '@/components/nav/pageColumn';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { space } from '@/constants/tokens';
import { useOpenSearch } from '@/hooks/useSearchFrom';
import type { HadDrink } from '@/lib/hadDrinks';

import { BestRows, YouTop } from './YouParts';

/** The states' page: the tab's own header with the gear, then You under your name (Sta-you). */
function StatePage({ name, children }: { name: string; children: ReactNode }) {
  const ds = useDs();
  const bottom = useTabBarInset();
  const column = usePageColumn('text');
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottom }}>
        <YouTop place />
        <View style={[column, styles.body]}>
          <View>
            <Caption tone="muted">{name}</Caption>
            <Head aria-level={1}>You</Head>
          </View>
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

/** Sta-you step 1: nothing yet, and the way to your first rank. */
export function YouEmpty({ name }: { name: string }) {
  const openSearch = useOpenSearch();
  return (
    <StatePage name={name}>
      <PencilState kind="empty" title="No ranks yet" detail="Rank your first drink tonight and your list starts here." action={{ label: 'Rank a drink', onPress: () => openSearch() }} />
    </StatePage>
  );
}

/** Sta-you step 2: the page's shape in outline while it comes. */
export function YouLoading({ name }: { name: string }) {
  return (
    <StatePage name={name}>
      <OutlineRows count={1} round pic={64} />
      <SectionLabel title="Your best" />
      <OutlineRows count={4} />
    </StatePage>
  );
}

/** You couldn't load (Sta-errors): what happened, Try again, and what still works. */
export function YouError({ name, onRetry }: { name: string; onRetry: () => void }) {
  return (
    <StatePage name={name}>
      <PencilState kind="error" title="You didn’t load" detail="The connection dropped halfway." action={{ label: 'Try again', onPress: onRetry }} />
      <ListNote icon="exclamationmark.circle" text="What’s on this phone still works: the spec book and search." />
    </StatePage>
  );
}

/** Sta-you step 4, no connection: your best from this phone, and what happens to a new rank. */
export function YouOffline({ name, best }: { name: string; best: readonly HadDrink[] }) {
  return (
    <StatePage name={name}>
      <SavedChip />
      {best.length ? (
        <>
          <SectionLabel title="Your best" />
          <BestRows drinks={best} />
        </>
      ) : null}
      <ListNote icon="exclamationmark.circle" text="A rank you make now is kept here and sent when you’re back." />
    </StatePage>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { gap: space.lg, paddingTop: space.sm },
});
