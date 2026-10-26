import { createContext, useContext } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, GlassSurface, Surface, Tag, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';
import type { SearchShow } from '@/lib/searchScope';
import { canMakeLabel, type VenueCanMake } from '@/lib/venueCanMake';

// Can make, on Everywhere at a venue (QA Q37, board w3-can-make): each drink
// says whether the back bar makes it, and one chip keeps only those. The
// answers come from venue_can_make (hooks/useVenueCanMake.ts).

/** The venue's answers for the drinks in the results, by drink id. Null away from a venue's Everywhere. */
export const CanMakeContext = createContext<Record<string, VenueCanMake> | null>(null);

/** Under a drink row's lines: "Can make", or "Missing 2: Suze, Lillet Blanc". Nothing with no answer for it. */
export function CanMakeTag({ itemId }: { itemId: string }) {
  const v = useContext(CanMakeContext)?.[itemId];
  if (!v) return null;
  return <Tag label={canMakeLabel(v)} tone={v.canMake ? 'success' : 'outline'} icon={v.canMake ? 'checkmark' : undefined} wrap />;
}

/** In the glass row, between the place and the type chips: Can make, with how many drinks it keeps. */
export function CanMakeChip({ show, onShow, count }: { show: SearchShow; onShow: (show: SearchShow) => void; count?: number }) {
  const ds = useDs();
  const on = show === 'canmake';
  return (
    <GlassSurface interactive style={styles.track}>
      <Chip
        look="glass"
        label="Can make"
        // A string, so none still says 0.
        count={count === undefined ? undefined : String(count)}
        selected={on}
        multi
        leading={<IconSymbol name="checkmark" size={14} color={on ? ds.accentFill.text : ds.c.ink} />}
        onPress={() => onShow(on ? 'all' : 'canmake')}
      />
    </GlassSurface>
  );
}

/** Can make is on and none of the drinks fit. Show all turns it off; the field and the place stay. */
export function CanMakeEmpty({ venue, drinks, query, onShowAll }: { venue: string; drinks: number; query: string; onShowAll?: () => void }) {
  return (
    <Surface style={styles.empty}>
      <Body>{`${venue} can’t make any of these yet.`}</Body>
      <Caption tone="muted">{`Of the ${drinks} ${drinks === 1 ? 'drink' : 'drinks'} for “${query}”, none has everything on the back bar.`}</Caption>
      {onShowAll ? (
        <View style={styles.row}>
          <Button label="Show all" size="sm" variant="secondary" onPress={onShowAll} />
        </View>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  // As SearchParts' chip track: a 36-point chip in a 4-point track, 44 tall.
  track: { padding: space.xs },
  empty: { gap: space.sm },
  row: { flexDirection: 'row', marginTop: space.xs },
});
