import { StyleSheet, View } from 'react-native';

import { Button, Caption } from '@/components/ds';
import { SearchBody, SearchHead, type SearchArea } from '@/components/search/SearchPanel';
import { space } from '@/constants/tokens';
import type { SearchMine } from '@/hooks/useSearchMine';
import { kindsTitle } from '@/lib/discoverDrinks';
import type { SearchScope } from '@/lib/searchScope';

import { FiltersChip } from './DiscoverControls';
import { DiscoverOverlay } from './DiscoverSheet';

interface DiscoverSearchProps {
  query: string;
  onQuery: (query: string) => void;
  scope: SearchScope;
  onScope: (scope: SearchScope) => void;
  mine: SearchMine;
  /** This area (the map, or the area chip) and Discover's filters. */
  area: SearchArea;
  onClearKinds: () => void;
  onClose: () => void;
  /** How many filters are on, and the way to them, beside the scope (disc-desk-search). */
  filters?: number;
  onFilters?: () => void;
}

/** The field and scope, plus a line for Discover's filters, which narrow the search too. */
export function DiscoverSearchHead({ query, onQuery, scope, onScope, mine, area, onClearKinds, onClose, filters = 0, onFilters }: DiscoverSearchProps) {
  const kinds = area.kinds;
  return (
    <View style={styles.head}>
      <SearchHead query={query} onQuery={onQuery} scope={scope} onScope={onScope} mine={mine} area={area} autoFocus onDone={onClose} />
      {kinds.length || onFilters ? (
        <View style={styles.row}>
          {onFilters ? <FiltersChip filters={filters} onPress={onFilters} /> : null}
          <Caption tone="muted" style={styles.flex}>{kinds.length ? `With your filters: ${kindsTitle(kinds)}` : ''}</Caption>
          {kinds.length ? <Button label="Clear filters" variant="ghost" onPress={onClearKinds} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Discover's door into the one search, opened on this area (what the map
 * shows). What's typed also narrows the list and map behind, so Done keeps
 * the search.
 */
export function DiscoverSearchSheet(props: DiscoverSearchProps) {
  return (
    <DiscoverOverlay label="Search" full onClose={props.onClose} head={<DiscoverSearchHead {...props} />}>
      <SearchBody query={props.query} scope={props.scope} onScope={props.onScope} mine={props.mine} area={props.area} />
    </DiscoverOverlay>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
});
