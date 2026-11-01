import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { BackbarTheme, Body, Caption, DrinkImage, Segmented, useDs } from '@/components/ds';
import { BlockLabel } from '@/components/screens/rankings/ScoreRows';
import { space } from '@/constants/tokens';
import { useDrinkGuestSays } from '@/hooks/useScores';
import { DRINK_REASONS } from '@/lib/rankResult';
import { floorProgress, sinceDay, tallyRows } from '@/lib/scores';

import { Meter, Note, ScorePage, Stats } from './ScoreParts';

/**
 * What guests say about one of the bar's drinks (Loop-reasons "barsays"), for
 * its Drink Creators: liked, fine and not for me, and the reasons, version by
 * version. Totals only, once 20 people have ranked a version, so nobody can
 * be picked out.
 */
export function GuestSaysScreen({ itemId, name, barName }: { itemId: string; name?: string; barName?: string }) {
  return (
    <BackbarTheme>
      <GuestSays itemId={itemId} eyebrow={[name, barName].filter(Boolean).join(' · ') || null} />
    </BackbarTheme>
  );
}

function GuestSays({ itemId, eyebrow }: { itemId: string; eyebrow: string | null }) {
  const ds = useDs();
  const { data, isLoading, error } = useDrinkGuestSays(itemId);
  const [picked, setPicked] = useState<number | null>(null);
  const versions = data?.versions ?? [];
  const v = versions.find((x) => x.version === picked) ?? versions[0];
  let body;
  if (error) body = <Body tone="muted">{(error as { code?: string }).code === '42501' ? 'Only the bar’s Drink Creators see what guests say.' : 'Couldn’t load what guests say. Try again in a moment.'}</Body>;
  else if (isLoading) body = <ActivityIndicator color={ds.c.muted} />;
  else if (!v) body = <Body tone="muted">Nobody has ranked it yet. What guests say shows here once 20 people have.</Body>;
  else if (v.liked == null)
    body = (
      <>
        <Body tone="muted">{`Version ${v.version}${v.since ? ` went on ${sinceDay(v.since)}` : ''}. Reasons show once ${data!.floor} people have ranked it, so nobody can be picked out.`}</Body>
        <View style={styles.drawing}>
          <DrinkImage itemId={itemId} accessibilityLabel="" style={styles.glass} sketchDetail="thumb" />
        </View>
        <Caption tone="muted" style={styles.center}>{`${floorProgress(v.rankers, data!.floor)} so far`}</Caption>
      </>
    );
  else {
    const rows = tallyRows(v.reasons, DRINK_REASONS);
    body = (
      <>
        <Stats
          items={[
            { title: 'Liked', value: String(v.liked) },
            { title: 'Fine', value: String(v.fine ?? 0) },
            { title: 'Not for me', value: String(v.not_for_me ?? 0) },
          ]}
        />
        <View>
          <BlockLabel aside={`${v.rankers} ranks`}>Reasons</BlockLabel>
          {rows.length ? <Meter rows={rows.map((r) => ({ label: r.label, n: r.n, warn: r.negative }))} /> : <Body tone="muted">Nobody gave a reason yet.</Body>}
        </View>
        <Note icon="lock.fill">Totals only, for this version. Never who said it.</Note>
      </>
    );
  }
  return (
    <ScorePage eyebrow={eyebrow} title="What guests say">
      {versions.length > 1 ? (
        <Segmented accessibilityLabel="Spec version" options={versions.map((x) => ({ value: String(x.version), label: `Version ${x.version}` }))} value={String(v?.version ?? '')} onChange={(x) => setPicked(Number(x))} />
      ) : null}
      {body}
    </ScorePage>
  );
}

const styles = StyleSheet.create({
  drawing: { alignItems: 'center', paddingVertical: space.md },
  glass: { width: 130, height: 170 },
  center: { textAlign: 'center' },
});
