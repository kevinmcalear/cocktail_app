import { StyleSheet, View } from 'react-native';

import { Caption, Chip, Headline } from '@/components/ds';
import { ListNote } from '@/components/screens/rankings/RankingLists';
import { space } from '@/constants/tokens';
import { findBars, type DiscoverBar, type DiscoverDrink } from '@/lib/discoverDrinks';
import { findKinds } from '@/lib/drinkStyles';
import { areaLabel, type Area } from '@/lib/nearMe';

import { ChipRow } from './DiscoverArea';
import { BarList, DrinkAtBarList } from './DrinksAtBars';

const MAX_BARS = 5;

interface Props {
  search: string;
  area: Area;
  /** Drinks at bars matching the search (and the picked style, in the area). */
  drinks: DiscoverDrink[];
  bars: DiscoverBar[];
  barsById: ReadonlyMap<string, DiscoverBar>;
  isLoading: boolean;
  signedIn: boolean;
  /** Pick a style or spirit the search named, and clear the search. */
  onKind: (kind: string) => void;
}

/**
 * What Discover's search finds: the styles and spirits it names ("gin",
 * "marg"), bars by name or city, and drinks at bars by name, ingredient or
 * description. Bars are found anywhere; drinks stay in the area.
 */
export function DiscoverSearchResults({ search, area, drinks, bars, barsById, isLoading, signedIn, onKind }: Props) {
  const kinds = findKinds(search);
  const foundBars = findBars(bars, search).slice(0, MAX_BARS);
  const where = areaLabel(area);

  return (
    <View style={styles.results}>
      {kinds.length ? (
        <ChipRow label="Browse">
          {kinds.map((k) => (
            <Chip key={k.id} label={k.label} selected={false} onPress={() => onKind(k.id)} />
          ))}
        </ChipRow>
      ) : null}

      {foundBars.length ? (
        <View style={styles.section}>
          <Caption tone="muted">Bars</Caption>
          <BarList bars={foundBars} />
        </View>
      ) : null}

      <View style={styles.section}>
        <Caption tone="muted">{`Drinks at bars ${where}`}</Caption>
        <Headline role="heading">{drinks.length ? `${drinks.length} ${drinks.length === 1 ? 'drink' : 'drinks'}` : 'Drinks'}</Headline>
        {!signedIn ? (
          <ListNote>Sign in to search the drinks bars pour.</ListNote>
        ) : isLoading ? (
          <ListNote>Loading…</ListNote>
        ) : drinks.length ? (
          <DrinkAtBarList drinks={drinks} barsById={barsById} limit={12} />
        ) : (
          <ListNote>{`No drinks ${where} match "${search.trim()}".${area.kind === 'anywhere' ? '' : ' Try Anywhere.'}`}</ListNote>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  results: { gap: space.lg },
  section: { gap: space.xs },
});
