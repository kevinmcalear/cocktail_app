import { useBars } from '@/hooks/useBars';
import { useSpecLevels } from '@/hooks/useSpecLevels';
import { useRoleMatrix } from '@/hooks/useVenueRoles';
import { useEffectiveRole, useRoleAt } from '@/hooks/useViewAs';
import { roleLabel } from '@/lib/roles';
import { NO_SPECS_MOVE, specAccess, type SpecAccess, type SpecLevels, type SpecsMove } from '@/lib/spec';

/**
 * Whether the person's own role at this venue gives or takes away specs, as
 * app_recipe_presentation applies it: their venue role's, or the venue's
 * change to their built-in role. Under View as a lower role, none (the
 * server shows the built-in role there too).
 */
export function useSpecsMove(barId: string | null | undefined): SpecsMove {
  const { data: bars } = useBars();
  const { previewing } = useRoleAt(barId);
  const me = barId ? bars?.find((b) => b.bar_id === barId) : undefined;
  const { data: matrix } = useRoleMatrix(me ? barId : null);
  if (!me || previewing) return NO_SPECS_MOVE;
  const roleId: string | null = me.venue_role_id ?? null;
  const row = matrix?.find((r) => (roleId ? r.role_id === roleId : r.role_id === null && r.base_level === me.role_level));
  return row ? { granted: row.granted.includes('specs'), revoked: row.revoked.includes('specs') } : NO_SPECS_MOVE;
}

/**
 * What this role can see of a drink's spec, and who opens the amounts. The
 * server has already blanked anything hidden; this is for labelling and for
 * hiding controls (like Batch) that would have nothing to show. A preview
 * (Who sees what, /dev/drink) shows a built-in role, so no grant or revoke.
 */
export function useSpecAccess(
  itemId: string | null | undefined,
  barId: string | null | undefined,
  preview?: { role: number; levels: SpecLevels }
): { access: SpecAccess; amountsOpenAt: string; levels: SpecLevels | null } {
  const realRole = useEffectiveRole(barId ?? null);
  const { data: realLevels } = useSpecLevels(preview ? null : itemId, barId);
  const move = useSpecsMove(preview ? null : barId);
  const levels = preview?.levels ?? realLevels ?? null;
  return {
    access: specAccess(preview?.role ?? realRole, levels, !!barId, move),
    amountsOpenAt: levels ? roleLabel(levels.measurement) : 'a higher role',
    levels,
  };
}
