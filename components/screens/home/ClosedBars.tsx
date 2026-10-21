import { BarResultRow, ResultGroup } from '@/components/search/ResultRows';
import type { DiscoverBar } from '@/lib/discoverDrinks';

/**
 * Bars that have shut, once "Closed bars" is on in Filters. Discover leaves
 * them out otherwise; search finds them either way.
 */
export function ClosedBars({ bars, shown, where, onShowBar }: { bars: DiscoverBar[]; shown: boolean; where: string; /** Hovering a row opens that bar on the map. */ onShowBar?: (barId: string | null) => void }) {
  if (!bars.length || !shown) return null;
  return <ResultGroup label={`Closed bars ${where}`} items={bars} render={(b) => <BarResultRow key={b.id} bar={b} onShowBar={onShowBar} />} />;
}
