import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Display, Headline } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { space } from '@/constants/tokens';
import { useRelease } from '@/hooks/usePublished';
import { dayLabel } from '@/lib/collection';
import { plural } from '@/lib/menus';

import { ReportAction } from '../safety/ReportSheet';
import { CollectButton } from './CollectButton';
import { BarLink } from './PublishedDrinkScreen';
import { loadFailure, PublicMissing, PublicShell } from './PublicShell';

/**
 * A bar's release ("Autumn release"), as anyone sees it: its cover, the date
 * it's known by, and its drinks that are still published, each opening its
 * public page. Collect keeps the release.
 */
export function ReleaseScreen({ id }: { id: string }) {
  const query = useRelease(id);
  const { data, isPending } = query;
  const [now] = useState(() => Date.now());
  if (!data) return <PublicMissing loading={isPending} what="release" failed={loadFailure(query)} />;

  const { release, bar, drinks } = data;
  const cover = release.coverUrl ?? drinks.find((d) => d.imageUrl && !d.imageIsGenerated)?.imageUrl ?? null;
  return (
    <PublicShell title={release.name} imageUrl={cover}>
      <BarLink bar={bar} />
      <Display>{release.name}</Display>
      <Caption tone="muted">{[dayLabel(release.releaseDate, now), plural(drinks.length, 'drink')].join(' · ')}</Caption>
      {release.description ? <Body tone="muted">{release.description}</Body> : null}
      <CollectButton target={{ kind: 'release', releaseId: release.id }} name={release.name} />
      <View style={styles.section}>
        <Headline role="heading">The drinks</Headline>
        {drinks.length ? (
          <View role="list">
            {drinks.map((d) => (
              <View role="listitem" key={d.id}>
                <DrinkRow
                  name={d.name}
                  href={`/d/${d.id}?release=${release.id}`}
                  imageUrl={d.imageUrl}
                  glass={null}
                  itemId={d.id}
                  caption={d.publishMode === 'spec' ? 'With the spec' : (d.description ?? undefined)}
                />
              </View>
            ))}
          </View>
        ) : (
          <Body tone="muted">None of this release’s drinks are public right now.</Body>
        )}
      </View>
      <View style={styles.report}>
        <ReportAction subject={release.name} targets={[{ label: release.name, target: { kind: 'release', releaseId: release.id } }]} />
      </View>
    </PublicShell>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  report: { alignItems: 'flex-start' },
});
