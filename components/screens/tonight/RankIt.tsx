import { useRouter } from 'expo-router';
import { lazy, Suspense, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { RankedNote, RankField, RankLabel, RankRow } from '@/components/screens/rank/RankFindParts';
import type { RankItStart } from '@/components/screens/rank/RankItFlow';
import { useSnapMenu } from '@/components/screens/rank/useSnapMenu';
import { space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import { useRankedTonight, useRankSuggestion } from '@/hooks/useRankIt';
import { tonightLine } from '@/lib/rankIt';

// The find and rank sheets load on the first tap, not with Tonight.
const RankItFlow = lazy(() => import('@/components/screens/rank/RankItFlow').then((m) => ({ default: m.RankItFlow })));

/**
 * "Had a drink? Rank it" at the top of home Tonight (Loop-rank board): the
 * field that opens the Rank it sheet, and under it one row. Before you rank,
 * a drink on your Want list that's on a list on now (a bar you love first);
 * once you've ranked tonight, that drink with your score and "Ranked. Had
 * another?".
 */
export function RankIt() {
  const router = useRouter();
  const signedIn = useSignedIn();
  const suggestion = useRankSuggestion();
  const tonight = useRankedTonight();
  const snap = useSnapMenu();
  // A new key each tap, so the flow starts over (and asks the age check again if it was closed).
  const [open, setOpen] = useState<{ key: number; start: RankItStart } | null>(null);
  const begin = (start: RankItStart) => (signedIn ? setOpen((o) => ({ key: (o?.key ?? 0) + 1, start })) : router.push('/auth/login'));
  const find = () => begin({ kind: 'find' });
  return (
    <View role="region" aria-label="Had a drink? Rank it" style={styles.block}>
      <RankLabel>Had a drink? Rank it</RankLabel>
      <RankField onPress={find} onCamera={snap} />
      {tonight ? (
        <>
          <RankRow itemId={tonight.itemId} name={tonight.name} sub={tonightLine(tonight)} score={tonight.score} />
          <RankedNote onPress={find} />
        </>
      ) : suggestion ? (
        <RankRow
          itemId={suggestion.itemId}
          name={suggestion.name}
          sub={`${suggestion.barName} · on your Want list`}
          onPress={() => begin({ kind: 'rank', itemId: suggestion.itemId, name: suggestion.name, barId: suggestion.barId })}
        />
      ) : null}
      {open ? (
        <Suspense fallback={null}>
          <RankItFlow key={open.key} start={open.start} onSnap={snap} onClose={() => setOpen(null)} />
        </Suspense>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
});
