import { lazy, Suspense, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { RankCameraButton, RankField, RankLabel } from '@/components/screens/rank/RankFindParts';
import type { RankItStart } from '@/components/screens/rank/RankItFlow';
import { space } from '@/constants/tokens';
import { useRankReturn } from '@/store/useRankReturn';

// The camera and the row under the field load after Tonight, in one chunk; the find and rank sheets on the first tap.
const RankItRow = lazy(() => import('./RankItRow').then((m) => ({ default: m.RankItRow })));
const RankCamera = lazy(() => import('./RankItRow').then((m) => ({ default: m.RankCamera })));
const RankItFlow = lazy(() => import('@/components/screens/rank/RankItFlow').then((m) => ({ default: m.RankItFlow })));

/**
 * "Had a drink? Rank it" at the top of home Tonight (Loop-rank board): the
 * field that opens the Rank it sheet, and under it one row (RankItRow).
 */
export function RankIt() {
  // A new key each tap, so the flow starts over (and asks the age check again if it was closed).
  const [open, setOpen] = useState<{ key: number; start: RankItStart } | null>(null);
  const begin = (start: RankItStart) => setOpen((o) => ({ key: (o?.key ?? 0) + 1, start }));
  const find = () => begin({ kind: 'find' });
  // Snap the menu went out to Bring in and is done (saved, or cancelled): Rank it opens again, with the search typed and the menu's drinks first.
  useEffect(
    () =>
      useRankReturn.subscribe((r) => {
        if (r.ret?.phase !== 'back') return;
        const back = r.take();
        if (back) setOpen((o) => ({ key: (o?.key ?? 0) + 1, start: { kind: 'find', query: back.query, menuId: back.menuId } }));
      }),
    []
  );
  return (
    <View role="region" aria-label="Had a drink? Rank it" style={styles.block}>
      <RankLabel>Had a drink? Rank it</RankLabel>
      <RankField
        onPress={find}
        camera={
          <Suspense fallback={<RankCameraButton />}>
            <RankCamera />
          </Suspense>
        }
      />
      <Suspense fallback={null}>
        <RankItRow onStart={begin} />
      </Suspense>
      {open ? (
        <Suspense fallback={null}>
          <RankItFlow key={open.key} start={open.start} onClose={() => setOpen(null)} />
        </Suspense>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
});
