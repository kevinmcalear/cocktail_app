import type { RoleMatrixRow } from '@/hooks/useVenueRoles';
import { plainDbMessage } from '@/lib/dbError';

/** A role in a link: a built-in role by its level ("level-30"), a venue's own by its id. */
export const roleKey = (r: Pick<RoleMatrixRow, 'role_id' | 'base_level'>): string => r.role_id ?? `level-${r.base_level}`;

/** The role a link names, from the venue's matrix. */
export function roleFromKey(matrix: readonly RoleMatrixRow[], key: string): RoleMatrixRow | null {
  const level = /^level-(\d+)$/.exec(key);
  if (level) return matrix.find((r) => r.role_id === null && r.base_level === Number(level[1])) ?? null;
  return matrix.find((r) => r.role_id === key) ?? null;
}

const GUEST = 10;

/**
 * The Roles list's order (Kept-team): the roles that do most first, so a Head
 * bartender sits under Admin; roles that end (a takeover) last. Guest, for
 * people who only look at the menu, shows only while someone holds it.
 */
export function rolesInOrder(matrix: readonly RoleMatrixRow[], members: readonly { role_level: number; venue_role_id?: string | null }[]): RoleMatrixRow[] {
  const guestHeld = members.some((m) => !m.venue_role_id && m.role_level === GUEST);
  return matrix
    .filter((r) => r.role_id || r.base_level !== GUEST || guestHeld)
    .slice()
    .sort((a, b) => Number(!!a.ends_at) - Number(!!b.ends_at) || b.capabilities.length - a.capabilities.length || b.base_level - a.base_level);
}

/** A role save or switch that failed, in words. */
export function roleProblem(error: unknown): string | null {
  if (!error) return null;
  const e = error as { code?: string; message?: string };
  if (e.code === '23505') return 'There’s already a role with that name.';
  if (e.code === '23514' && /staff/.test(e.message ?? '')) return 'An Admin always keeps Invite and manage the team.';
  if (e.code === '42501') return 'Only people who manage the team change roles.';
  return plainDbMessage(error) ?? "Couldn't save that. Check your connection and try again.";
}
