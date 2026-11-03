import { RankedNote, RankRow } from '@/components/screens/rank/RankRow';
import type { RankItStart } from '@/components/screens/rank/RankItFlow';
import { useRankedTonight, useRankSuggestion } from '@/hooks/useRankIt';
import { tonightLine } from '@/lib/rankIt';

export { RankCamera } from '@/components/screens/rank/RankCamera';

/**
 * The row under "What did you have?": before you rank, a drink on your Want
 * list that's on a list on now (a bar you love first); once you've ranked
 * tonight, that drink with your score and "Ranked. Had another?". It waits on
 * its queries anyway, so it loads after Tonight (B13 /).
 */
export function RankItRow({ onStart }: { onStart: (start: RankItStart) => void }) {
  const suggestion = useRankSuggestion();
  const tonight = useRankedTonight();
  if (tonight) {
    return (
      <>
        <RankRow itemId={tonight.itemId} imageUrl={tonight.imageUrl} name={tonight.name} sub={tonightLine(tonight)} score={tonight.score} />
        <RankedNote onPress={() => onStart({ kind: 'find' })} />
      </>
    );
  }
  if (!suggestion) return null;
  return <RankRow itemId={suggestion.itemId} name={suggestion.name} sub={`${suggestion.barName} · on your Want list`} onPress={() => onStart({ kind: 'rank', itemId: suggestion.itemId, name: suggestion.name, barId: suggestion.barId })} />;
}
