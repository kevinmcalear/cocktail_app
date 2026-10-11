import { StyleSheet, View } from 'react-native';

import { space } from '@/constants/tokens';
import { useBarFacts } from '@/hooks/useBarFacts';
import { useLastPlace } from '@/store/useLastPlace';

import { AddressLine, BarContact, HoursLine } from './BarFactLines';

/**
 * A bar page's "Hours and location" (disc-search-bar): open now or not
 * (the row opens this week's hours, "Hours"), the address and how far, then
 * Directions, Call and Website. For profiles, public pages and venue tools too.
 */
export function BarFactsBlock({ profileId }: { profileId: string }) {
  const facts = useBarFacts(profileId).data;
  // ponytail: the last near-me place, snapped to about 1 km, so the distance is rough; a live position needs the location prompt on this page.
  const from = useLastPlace((s) => s.place);
  if (!facts) return null;
  return (
    <View role="group" aria-label="Hours and location" style={styles.block}>
      <HoursLine facts={facts} sheet />
      <AddressLine facts={facts} from={from} />
      <BarContact facts={facts} from={from} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
});
