import { StyleSheet, View } from 'react-native';

import { Caption, useDs } from '@/components/ds';
import { font, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import type { Tally } from '@/lib/importReview';

// Its own file: the Library's ResumeCard shows it, and ReviewParts brings the
// review's spec and page pictures (and the prep kinds) with it.

/** The bar that counts checked out of total, and the words beside it. */
export function ProgressLine({ t, words }: { t: Tally; words: string }) {
  const ds = useDs();
  const share = t.total ? Math.round((t.checked / t.total) * 100) : 0;
  return (
    <View style={styles.progress}>
      <View role="progressbar" aria-label={words} aria-valuemin={0} aria-valuemax={100} aria-valuenow={share} style={[styles.track, { backgroundColor: withAlpha(ds.c.ink, 0.12) }]}>
        <View style={[styles.fill, { width: `${share}%`, backgroundColor: ds.accentText }]} />
      </View>
      <Caption tone="muted" numberOfLines={1} style={styles.mono}>
        {words}
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  track: { flex: 1, height: 6, borderRadius: radius.mark, overflow: 'hidden' },
  fill: { height: 6, borderRadius: radius.mark },
  mono: { ...font.figures },
});
