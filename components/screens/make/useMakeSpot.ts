import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useBarZones, useItemLocations } from '@/hooks/useBackBar';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useMode } from '@/hooks/useMode';
import { locationLine } from '@/lib/backBar';

/**
 * Where a made batch goes at the venue you're working: its first back bar
 * spot ("Fridge 2 · top shelf"). Null at home, without the `locations`
 * capability, or when it has no spot yet.
 */
export function useMakeSpot(itemId: string): string | null {
  const { active } = useActiveVenue();
  const home = useMode().mode === 'home';
  const barId = home ? null : (active?.id ?? null);
  const caps = useCapabilities(barId);
  const canRead = Array.isArray(caps.data) && caps.data.includes('locations');
  const { data: zones = [] } = useBarZones(canRead ? barId : null);
  const { data: locations = [] } = useItemLocations(canRead ? barId : null);
  const here = locations.find((l) => l.item_id === itemId);
  if (!here) return null;
  return locationLine(zones.find((z) => z.id === here.zone_id)?.name, here.shelf) || null;
}
