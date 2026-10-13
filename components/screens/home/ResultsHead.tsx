import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Caption, Title } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useSpecMatches } from '@/hooks/useSpecMatches';
import { drinkCount, type DiscoverDrink } from '@/lib/discoverDrinks';
import { classicSummary } from '@/lib/discoverMatch';

/** "5 bars near you pour the classic, 2 pour a variation", from the results' spec verdicts; nothing when none is a version of a classic. */
export function ClassicLine({ drinks, search, where }: { drinks: readonly DiscoverDrink[]; search: string; where: string }) {
  const ids = drinks.slice(0, 500).map((d) => d.id);
  const verdicts = useSpecMatches(search.trim() ? `discover:${search.trim()}` : undefined, ids).data;
  const line = verdicts ? classicSummary(drinks, verdicts, where) : null;
  return line ? <Caption>{line}</Caption> : null;
}

/** "14 drinks at 9 bars near you" while searching, else how many bars the map shows. */
export function resultsCaption(searching: boolean, totals: { drinks: number; bars: number } | null | undefined, where: string, pins: number): string {
  if (searching && totals?.drinks) return `${drinkCount(totals.drinks)} at ${totals.bars} ${totals.bars === 1 ? 'bar' : 'bars'} ${where}`;
  return `${pins} ${pins === 1 ? 'bar' : 'bars'} in view · tap or swipe up for the list`;
}

interface ResultsHeadProps {
  caption: string;
  title: string;
  /** The layer (browsing) or sort (searching) chips. */
  chips: ReactNode;
  /** Under the chips while searching: the classic line. */
  below?: ReactNode;
  /** Phones: the caption opens the sheet, for anyone who taps rather than swipes. */
  onOpen?: () => void;
  onLayout?: (e: LayoutChangeEvent) => void;
}

/** The results' head (disc-map, disc-search-map): the count, the title, the chips, then the classic line. */
export function ResultsHead({ caption, title, chips, below, onOpen, onLayout }: ResultsHeadProps) {
  const cap = (
    <Caption tone="muted" numberOfLines={1}>
      {caption}
    </Caption>
  );
  return (
    <View style={styles.head} onLayout={onLayout}>
      {onOpen ? (
        <Pressable role="button" accessibilityLabel={`${caption}. Show the list`} onPress={onOpen}>
          {cap}
        </Pressable>
      ) : (
        cap
      )}
      <Title role="heading" numberOfLines={1}>
        {title}
      </Title>
      {chips}
      {below}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.md },
});
