import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Caption, Title } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useSpecMatches } from '@/hooks/useSpecMatches';
import type { DiscoverDrink } from '@/lib/discoverDrinks';
import { classicSummary } from '@/lib/discoverMatch';

/** "5 bars near you pour the classic, 2 pour a variation", from the results' spec verdicts; nothing when none is a version of a classic. */
export function ClassicLine({ drinks, search, where }: { drinks: readonly DiscoverDrink[]; search: string; where: string }) {
  const ids = drinks.slice(0, 500).map((d) => d.id);
  const verdicts = useSpecMatches(search.trim() ? `discover:${search.trim()}` : undefined, ids).data;
  const line = verdicts ? classicSummary(drinks, verdicts, where) : null;
  return line ? <Caption>{line}</Caption> : null;
}

interface ResultsHeadProps {
  /** Empty on wide screens with no search count: nothing is drawn. */
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
  const cap = caption ? (
    <Caption tone="muted" numberOfLines={1}>
      {caption}
    </Caption>
  ) : null;
  return (
    <View style={styles.head} onLayout={onLayout}>
      {onOpen && cap ? (
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
