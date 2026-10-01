import { ROLE_LEVELS } from '@/lib/roles';

/** Employee and above can open My team. */
export const TEAM_SEE = ROLE_LEVELS.find((r) => r.label === 'Employee')!.level;
/** Only an Admin can add, remove, look up, or change a role. */
export const TEAM_MANAGE = ROLE_LEVELS.find((r) => r.label === 'Admin')!.level;

export function canSeeTeam(role: number): boolean {
  return role >= TEAM_SEE;
}

export function canManageTeam(role: number): boolean {
  return role >= TEAM_MANAGE;
}

/** The name on the roster: what they signed up with, else the part before @. */
export function personName(p: { display_name?: string | null; email: string | null }): string {
  const named = p.display_name?.trim();
  if (named) return named;
  const local = p.email?.split('@')[0];
  return local || 'Team member';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Joined 4 Mar 2026", in UTC so the label doesn't depend on the device zone. */
export function joinedLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `Joined ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * The roster an admin is looking through. An empty query keeps everyone.
 * Matches the visible name or the email.
 */
export function roster<T extends { display_name?: string | null; email: string | null }>(people: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  const shown = q
    ? people.filter((p) => personName(p).toLowerCase().includes(q) || (p.email ?? '').toLowerCase().includes(q))
    : people.slice();
  return shown.sort((a, b) => personName(a).localeCompare(personName(b)) || (a.email ?? '').localeCompare(b.email ?? ''));
}
