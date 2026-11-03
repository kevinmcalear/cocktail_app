import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Segmented } from '@/components/ds';
import { ScreenHeader } from '@/components/nav/ScreenHeader';
import { TonightHead } from '@/components/screens/tonight/TonightParts';
import { space } from '@/constants/tokens';
import type { Show } from '@/lib/libraryFilters';

export type LibrarySegment = 'drinks' | 'house' | 'bottles';
const SEGMENTS = [
  { value: 'drinks', label: 'Drinks' },
  { value: 'house', label: 'House-made' },
  { value: 'bottles', label: 'Bottles' },
] as const;

/**
 * The top of Drinks at a venue (Prod-drinks): the place row, the bar's name
 * over "Drinks" in the display face, then the Drinks / House-made / Bottles
 * switch. `find` is wide screens' find field, in the header row.
 */
export function LibraryHead({ gutter, eyebrow, segment, onSegment, find }: { gutter: number; eyebrow: string; segment: LibrarySegment | null; onSegment: (s: LibrarySegment) => void; find?: ReactNode }) {
  return (
    <View style={{ gap: space.md }}>
      <View style={{ marginLeft: -gutter, marginRight: -gutter }}>
        <ScreenHeader actions={find} />
      </View>
      <TonightHead eyebrow={eyebrow} title="Drinks" />
      {segment ? <Segmented variant="ink" stretch options={SEGMENTS} value={segment} onChange={onSegment} accessibilityLabel="Drinks" /> : null}
    </View>
  );
}

/** The switch's segment for a view, and the view each segment opens on. */
export function segmentOf(show: Show): LibrarySegment {
  return show === 'preps' || show === 'garnishes' ? 'house' : show === 'bottles' || show === 'ingredients' || show === 'needs-price' ? 'bottles' : 'drinks';
}
export const SEGMENT_HOME: Record<LibrarySegment, Show> = { drinks: 'all', house: 'preps', bottles: 'bottles' };
