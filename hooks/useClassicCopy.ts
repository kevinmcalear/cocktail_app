import { useDrinkCredit } from '@/hooks/useLineage';
import { useSpecMatches } from '@/hooks/useSpecMatches';

/**
 * A bar's copy of a catalog classic poured to the exact spec (board
 * drink-phone-barcopy): its credit, backstory and riffs are the classic's.
 * Null for anything else, and until the verdict loads. Shares DrinkCredit's
 * and VersionBanner's queries.
 */
export function useClassicCopy(itemId: string | null | undefined): { classicId: string; classicName: string; barName: string | null } | null {
  const { data: own } = useDrinkCredit(itemId);
  const classic = own?.riff_of?.is_catalog ? own.riff_of : null;
  const { data: matches } = useSpecMatches(classic && itemId ? itemId : undefined, classic && itemId ? [itemId] : []);
  if (!classic || !itemId || matches?.[itemId]?.spec_match !== 'same') return null;
  return { classicId: classic.id, classicName: classic.name, barName: own?.origin_bar?.display_name ?? null };
}
