import { useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, PressableScale, Spec, TextLink, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useItemScores } from '@/hooks/useFlavor';
import { creditSentence, creditText, type LineageDrink } from '@/lib/lineage';

import { FactRow } from './FactRow';
import { Score } from './Score';
import { byScore } from './ServedAt';

/** Riffs shown before "All N riffs". */
const TOP = 3;

/** "By Jo Marsh at Pale Moth, 2025" for a riff row; names only, no links. */
export function byLine(d: LineageDrink): string {
  return creditText(creditSentence(d, null)) || (d.origin ?? '');
}

interface RankedRiffsProps {
  label: string;
  riffs: LineageDrink[];
  /** "100+" when the list is cut. */
  mark: string;
  /** Under the label: who made them, or "The best, ranked". */
  summary: ReactNode;
  accessibilityLabel: string;
  /** Start a new drink from this one; null when you can't make drinks here. */
  onRiff: (() => void) | null;
}

/**
 * The riffs on a drink, open with the best three ranked by score (boards
 * drink-phone-venue and -classic), "All N riffs" for the rest, and Riff on
 * this to start your own.
 */
export function RankedRiffs({ label, riffs, mark, summary, accessibilityLabel, onRiff }: RankedRiffsProps) {
  const ds = useDs();
  const router = useRouter();
  const [all, setAll] = useState(false);
  const { data: scores = {} } = useItemScores(riffs.map((r) => r.id));
  const ranked = byScore(riffs, scores);
  const shown = all ? ranked : ranked.slice(0, TOP);
  return (
    <FactRow
      label={label}
      mark={mark}
      accessibilityLabel={accessibilityLabel}
      defaultOpen
      more={
        <>
          <View role="list">
            {shown.map((r, i) => (
              <PressableScale
                key={r.id}
                role="link"
                accessibilityLabel={`${scores[r.id] != null ? `Number ${i + 1}, ` : ''}${r.name}. ${byLine(r)}${scores[r.id] != null ? `. Score ${scores[r.id]}` : ''}`}
                onPress={() => router.push(`/cocktail/${r.id}` as Href)}
                style={[styles.row, { borderTopColor: ds.c.line }]}
              >
                <Spec tone="muted" style={styles.rank}>
                  {scores[r.id] != null ? String(i + 1) : ''}
                </Spec>
                <View style={styles.flex}>
                  <Body numberOfLines={1}>{r.name}</Body>
                  {byLine(r) ? (
                    <Caption tone="muted" numberOfLines={1}>
                      {byLine(r)}
                    </Caption>
                  ) : null}
                </View>
                <Score score={scores[r.id]} hideEmpty />
              </PressableScale>
            ))}
          </View>
          <View style={styles.actions}>
            {onRiff ? <Button label="Riff on this" icon="plus" variant="secondary" onPress={onRiff} /> : null}
            {riffs.length > TOP ? <TextLink label={all ? 'Fewer' : `All ${mark} riffs ›`} onPress={() => setAll(!all)} /> : null}
          </View>
        </>
      }
    >
      {summary}
    </FactRow>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
  rank: { width: space.lg },
  flex: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
});
