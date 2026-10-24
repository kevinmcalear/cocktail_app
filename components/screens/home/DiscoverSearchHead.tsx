import { StyleSheet, View } from 'react-native';

import { Button, Caption } from '@/components/ds';
import { SearchHead, type SearchArea } from '@/components/search/SearchPanel';
import { space } from '@/constants/tokens';
import type { SearchMine } from '@/hooks/useSearchMine';
import { kindsTitle } from '@/lib/discoverDrinks';
import type { SearchScope } from '@/lib/searchScope';

import { FiltersChip } from './DiscoverControls';

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

/**
 * Wide Discover's search, in its list pane (disc-desk-search): the field and scope, plus a line
 * for Discover's filters, which narrow the search too. Phones search in the search tab instead.
 */
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

const styles = StyleSheet.create({
  head: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
});
