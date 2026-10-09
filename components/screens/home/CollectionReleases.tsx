import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, Headline } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { space } from '@/constants/tokens';
import { useCollection } from '@/hooks/useCollection';
import { dayLabel } from '@/lib/collection';
import { plural } from '@/lib/menus';

/** Releases collected from bars, on Collection's Menus. Nothing when there are none. */
export function CollectionReleases() {
  const releases = useCollection().data?.releases ?? [];
  const [now] = useState(() => Date.now());
  if (!releases.length) return null;
  return (
    <View style={styles.section}>
      <Headline role="heading">Releases</Headline>
      <Caption tone="muted">{`${plural(releases.length, 'release')} from bars`}</Caption>
      <View role="list">
        {releases.map((r) => (
          <View role="listitem" key={r.id}>
            <DrinkRow
              name={r.name}
              href={r.live && r.releaseId ? `/r/${r.releaseId}` : undefined}
              imageUrl={r.coverUrl}
              glass={null}
              caption={[r.barName, r.releaseDate ? dayLabel(r.releaseDate, now) : null, r.live ? null : 'No longer public'].filter(Boolean).join(' · ')}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xs },
});
