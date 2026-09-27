import { useSpecLevels } from '@/hooks/useSpecLevels';
import { useEffectiveRole } from '@/hooks/useViewAs';
import { roleLabel } from '@/lib/roles';
import { specAccess, type SpecAccess, type SpecLevels } from '@/lib/spec';

/**
 * What this role can see of a drink's spec, and who opens the amounts. The
 * server has already blanked anything hidden; this is for labelling and for
 * hiding controls (like Batch) that would have nothing to show.
 */
export function useSpecAccess(
  itemId: string | null | undefined,
  barId: string | null | undefined,
  preview?: { role: number; levels: SpecLevels }
): { access: SpecAccess; amountsOpenAt: string } {
  const realRole = useEffectiveRole(barId ?? null);
  const { data: realLevels } = useSpecLevels(preview ? null : itemId, barId);
  const levels = preview?.levels ?? realLevels ?? null;
  return {
    access: specAccess(preview?.role ?? realRole, levels, !!barId),
    amountsOpenAt: levels ? roleLabel(levels.measurement) : 'a higher role',
  };
}
