import { StyleSheet, Text, View } from 'react-native';

import { fontFamilies, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { matchParts } from '@/lib/matchParts';
import { formatScore } from '@/lib/ranking';

import { Caption, Spec } from './Text';
import { useDs } from './theme';

export interface RowScoreProps {
  /** The 0 to 10 score (a drink's, a bar's, or your own). Nothing is drawn for it when missing. */
  score?: number | null;
  /** A muted line under the score: "Bar 9.1", "212 ranked", "86% match", "bar". Shows on its own when there's no score. */
  detail?: string | null;
}

/**
 * A score at the end of a list row, the one way every list shows it (b02):
 * the number in Geist Mono (the spec style, tabular), right-aligned, with an
 * optional muted line under it. Draws nothing when there's neither, so a row
 * can always pass one. Pass it as DrinkRow's `trailing` (or any row's end),
 * and say the same in the row's label with `scoreWords`.
 *
 *   <RowScore score={8.7} detail="86% match" />
 *
 * Rank captions ("#2 of 11 Martinis near you · 23 ranked") are words, not a
 * mark: build them with `rankCaption` in lib/ranking.ts and put them in the
 * row's caption or note.
 */
export function RowScore({ score, detail }: RowScoreProps) {
  const has = score !== undefined && score !== null;
  if (!has && !detail) return null;
  return (
    <View style={styles.score}>
      {has ? <Spec>{formatScore(score)}</Spec> : null}
      {detail ? (
        <Caption tone="muted" numberOfLines={1}>
          {detail}
        </Caption>
      ) : null}
    </View>
  );
}

/** What a screen reader hears for a RowScore: "score 8.7, 86% match". Null when there's nothing. */
export function scoreWords(score?: number | null, detail?: string | null): string | null {
  const words = [score !== undefined && score !== null ? `score ${formatScore(score)}` : null, detail || null].filter(Boolean);
  return words.length ? words.join(', ') : null;
}

export interface MatchTextProps {
  text: string;
  /** What was searched; its words are lit wherever they fall. */
  query?: string;
  /**
   * accent: the word in the accent, a little bolder (the search page).
   * tint: ink on a soft accent wash (Discover's search and the bar page it opens).
   */
  look?: 'accent' | 'tint';
}

/**
 * The searched word lit inside a name or a why line. Nest it in a ds text
 * (Headline, Caption): it only colours the matched runs, so the outer style
 * holds. Plain text when nothing matches.
 */
export function MatchText({ text, query, look = 'accent' }: MatchTextProps) {
  const ds = useDs();
  const parts = query ? matchParts(text, query) : null;
  if (!parts?.some((p) => p.hit)) return text;
  const lit = look === 'tint' ? { backgroundColor: withAlpha(ds.accentText, 0.2), color: ds.c.ink, fontFamily: fontFamilies.bodySemiBold } : { color: ds.accentText, fontFamily: fontFamilies.bodySemiBold };
  return parts.map((p, i) =>
    p.hit ? (
      <Text key={i} style={lit}>
        {p.text}
      </Text>
    ) : (
      p.text
    )
  );
}

const styles = StyleSheet.create({
  score: { alignItems: 'flex-end', flexShrink: 0, gap: space.xs / 2 },
});
