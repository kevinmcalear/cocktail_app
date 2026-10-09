import { StyleSheet, View } from 'react-native';

import { Caption, Headline } from '@/components/ds';
import { space } from '@/constants/tokens';
import { usePublicSpecChanges } from '@/hooks/useVersions';
import { specDiff } from '@/lib/specDiff';

import { Versions } from '../drink/HistorySection';

/**
 * How a published spec changed, for guests, when the bar shows it (Publishing,
 * "Show how specs changed"). The database cuts each version down to what the
 * public spec shows. Nothing renders when the bar keeps it to the team.
 */
export function PublicSpecChanges({ itemId, who }: { itemId: string; who: string }) {
  const { data } = usePublicSpecChanges(itemId);
  if (!data?.length) return null;
  // A save that only changed what guests don't see (notes, dilution) isn't a change to them, and an empty first version says nothing.
  const shown = data.filter((v, i) => (i === data.length - 1 ? v.snapshot.lines.length : specDiff(data[i + 1].snapshot, v.snapshot).length));
  if (!shown.length) return null;
  return (
    <View style={styles.section}>
      <Headline role="heading">Spec changes</Headline>
      <Caption tone="muted">{`How ${who} has changed it, newest first.`}</Caption>
      <Versions itemId={itemId} versions={shown} canEdit={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
});
