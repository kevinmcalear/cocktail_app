import { Caption, Spec } from '@/components/ds';
import { formatScore } from '@/lib/ranking';

/**
 * A drink's score at the end of its row, in Geist Mono (decision b02), or
 * "No score" where nobody's ranked it enough yet.
 *
 * ponytail: the search/scores session is building the shared score component
 * on feat/canvas-search-scores. This draws it with the same tokens until that
 * lands; swap these call sites to it then.
 */
export function Score({ score, hideEmpty }: { score: number | null | undefined; hideEmpty?: boolean }) {
  if (score == null) return hideEmpty ? null : <Caption tone="muted">No score</Caption>;
  return <Spec accessibilityLabel={`Score ${formatScore(score)}`}>{formatScore(score)}</Spec>;
}
