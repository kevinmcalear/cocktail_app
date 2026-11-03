import { useState } from 'react';

import { useWantBars } from '@/hooks/useKept';
import { useMyHadDrinks } from '@/hooks/useRankings';
import { hoursStatus } from '@/lib/barHours';

/**
 * You's Want to go row: the bars you want to go to and haven't had a drink at
 * (as /your-bars lists them), and how many are open now. Its own file so the
 * pages that only love a bar (useKept) don't load your rankings.
 */
export function useWantSummary(): { count: number; open: number; isLoading: boolean; error: Error | null } {
  const { data: wanted = [], isLoading, error } = useWantBars();
  const had = useMyHadDrinks();
  const [now] = useState(() => new Date());
  const been = new Set((had.data ?? []).map((d) => d.venue?.id));
  const bars = wanted.filter((b) => !been.has(b.id));
  return { count: bars.length, open: bars.filter((b) => hoursStatus(b.hours, now, b.timezone)?.open).length, isLoading: isLoading || had.isLoading, error };
}
