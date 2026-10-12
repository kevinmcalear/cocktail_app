import { ROLE_LEVELS, roleLabel } from '@/lib/roles';

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

/** The role on a roster row: the venue's own ("Head bartender") when they hold one, else the base level. */
export function memberRoleName(m: { role_level: number; venue_role_name?: string | null }): string {
  return m.venue_role_name?.trim() || roleLabel(m.role_level);
}

/**
 * "Joined 3 Mar 2026 · Bartender since 1 Jun": the role date only when the
 * role changed after they joined (a later day). UTC, like joinedLabel.
 */
export function memberSinceLine(m: { role_level: number; venue_role_name?: string | null; joined_at?: string | null; role_since?: string | null }): string | null {
  const joined = joinedLabel(m.joined_at);
  const since = m.role_since ? new Date(m.role_since) : null;
  const joinedDay = m.joined_at ? new Date(m.joined_at).toISOString().slice(0, 10) : null;
  if (!since || Number.isNaN(since.getTime()) || since.toISOString().slice(0, 10) === joinedDay) return joined;
  const sameYear = m.joined_at && new Date(m.joined_at).getUTCFullYear() === since.getUTCFullYear();
  const day = `${since.getUTCDate()} ${MONTHS[since.getUTCMonth()]}${sameYear ? '' : ` ${since.getUTCFullYear()}`}`;
  const role = `${memberRoleName(m)} since ${day}`;
  return joined ? `${joined} · ${role}` : role;
}

/** "today", "yesterday", "2 days ago", "3 weeks ago": how long an invite has waited. */
export function agoLabel(iso: string | null | undefined, now: number): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const days = Math.max(0, Math.floor((now - t) / 86_400_000));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
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

/**
 * The roles an Admin can invite someone as, each with what it lets them do.
 * Guest isn't offered: it's for people who only look at the menu.
 */
export const INVITE_ROLES: { level: number; detail: string }[] = [
  { level: 20, detail: 'Sees menus, talking points and where things live' },
  { level: 30, detail: 'Plus prep notes and the staff list' },
  { level: 35, detail: 'Adds and edits drinks and menus' },
  { level: TEAM_MANAGE, detail: 'Everything, including the team' },
];

/** The invite button: "Email Sam an invite", by first name once there is one. */
export function inviteButtonLabel(name: string): string {
  const first = name.trim().split(/\s+/)[0];
  return first ? `Email ${first} an invite` : 'Email an invite';
}
