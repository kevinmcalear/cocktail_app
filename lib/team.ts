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

/** The role on a roster row: the venue's own ("Head bartender") when they hold one, else the base level. */
export function memberRoleName(m: { role_level: number; venue_role_name?: string | null }): string {
  return m.venue_role_name?.trim() || roleLabel(m.role_level);
}

/** "just now", "20 minutes ago", "3 hours ago", then as agoLabel: how long someone asking to join has waited. */
export function askedAgo(iso: string | null | undefined, now: number): string | null {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (Number.isNaN(t)) return null;
  const minutes = Math.max(0, Math.floor((now - t) / 60_000));
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes} minutes ago`;
  if (minutes < 120) return 'an hour ago';
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} hours ago`;
  return agoLabel(iso, now);
}

/** "today", "yesterday", "2 days ago", "3 weeks ago": how long something has waited. */
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

type RosterPerson = { display_name?: string | null; email: string | null };

const byName = (a: RosterPerson, b: RosterPerson) => personName(a).localeCompare(personName(b)) || (a.email ?? '').localeCompare(b.email ?? '');

/** The team's groups, in the board's order (Kept-team): who runs it, who makes the drinks, who's here for a while, who's on the floor. */
export type TeamGroupKey = 'admins' | 'bar' | 'guests' | 'floor';

export const TEAM_GROUPS: { key: TeamGroupKey; title: string }[] = [
  { key: 'admins', title: 'Admins' },
  { key: 'bar', title: 'Behind the bar' },
  { key: 'guests', title: 'Guests' },
  { key: 'floor', title: 'Floor' },
];

const BARTENDER = 30;

type TeamPerson = RosterPerson & { role_level: number; role_ends_at?: string | null; venue_role_name?: string | null };

/**
 * Which group a teammate is in: a role that ends is a guest; anyone who can
 * manage the team (an Admin, or a venue role with the staff permission, like
 * Head bartender) is with the Admins; Bartender and up are behind the bar;
 * the rest are on the floor.
 */
export function teamGroup(p: TeamPerson, managesTeam: boolean, now: number): TeamGroupKey {
  if (p.role_ends_at && new Date(p.role_ends_at).getTime() > now) return 'guests';
  if (managesTeam || p.role_level >= TEAM_MANAGE) return 'admins';
  if (p.role_level >= BARTENDER) return 'bar';
  return 'floor';
}

/** The team in its groups, highest role first inside each, then A to Z. Empty groups are left out. */
export function teamSections<T extends TeamPerson>(people: readonly T[], managesTeam: (p: T) => boolean, now: number): { key: TeamGroupKey; title: string; people: T[] }[] {
  return TEAM_GROUPS.map((g) => ({
    ...g,
    people: people.filter((p) => teamGroup(p, managesTeam(p), now) === g.key).sort((a, b) => b.role_level - a.role_level || byName(a, b)),
  })).filter((g) => g.people.length);
}

/** Whether a manager opens this person's page: never their own, and an Admin's only if they're an Admin (the database refuses the rest). */
export function canOpenMember(m: { user_id: string; role_level: number }, myId: string | null | undefined, myRole: number): boolean {
  return m.user_id !== myId && (myRole >= TEAM_MANAGE || m.role_level < TEAM_MANAGE);
}

/** What a built-in role on the floor sees, after its name on the row: "Employee · menus and allergens". */
const FLOOR_SEES: Record<number, string> = { 20: 'menus and allergens', 10: 'the menu' };

/**
 * The line under a teammate's name (Kept-team): their role, then "until Fri
 * 7 Nov" for a guest, "on shift tonight", or what a floor role sees.
 */
export function teamLine(p: TeamPerson, group: TeamGroupKey, onShift: boolean, ends: string | null, owner = false): string {
  const role = owner ? 'Owner' : memberRoleName(p);
  if (group === 'guests' && ends) return onShift ? `On shift tonight · until ${ends}` : `${role} · until ${ends}`;
  if (onShift) return `${role} · on shift tonight`;
  if (group === 'floor' && !p.venue_role_name?.trim() && FLOOR_SEES[p.role_level]) return `${role} · ${FLOOR_SEES[p.role_level]}`;
  return role;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LONG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Whole days from `from`'s local midnight to `to`'s. */
function dayGap(from: number, to: number): number {
  const a = new Date(from);
  const b = new Date(to);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** The day an invite went out, as the Invited row says it: "today", "yesterday", "Tuesday" this week, else "3 Mar". Local time. */
export function invitedDay(iso: string | null | undefined, now: number): string | null {
  const t = iso ? new Date(iso) : null;
  if (!t || Number.isNaN(t.getTime())) return null;
  const days = dayGap(t.getTime(), now);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return DAYS[t.getDay()];
  return `${t.getDate()} ${MONTHS[t.getMonth()]}`;
}

/** A person's next shift, as their page's stat says it: "Tonight", the short day this week ("Fri"), else "14 Nov". Local time. */
export function nextShiftLabel(startsAt: string | null | undefined, now: number): string | null {
  const t = startsAt ? new Date(startsAt) : null;
  if (!t || Number.isNaN(t.getTime())) return null;
  const days = dayGap(now, t.getTime());
  if (days <= 0) return 'Tonight';
  if (days < 7) return SHORT_DAYS[t.getDay()];
  return `${t.getDate()} ${MONTHS[t.getMonth()]}`;
}

/** "since March 2025": when they took their role, else when they joined. UTC, so the label doesn’t depend on the device zone. */
export function sinceLabel(m: { role_since?: string | null; joined_at?: string | null }): string | null {
  const iso = m.role_since ?? m.joined_at;
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return `since ${LONG_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
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

/** One row of the invite sheet's As list: a built-in role by its level, or one of the bar's own roles by its id. */
export interface InviteRoleOption {
  key: string;
  label: string;
  detail: string;
  level: number;
  /** Set for a bar's own role (venue_roles.id); null for a built-in one. */
  roleId: string | null;
}

/** The built-in roles in the order the board lists them: Bartender, Drink Creator, Employee, then Admin last. */
const AS_ORDER = [30, 35, 20];

/**
 * The As list on Invite > By email (Kept-team): the built-in roles up to the
 * inviter's ceiling, with the bar's own roles (a takeover bartender and the
 * like) before Admin. A role that has ended, and an Admin-level role, are
 * left out: invite_to_role refuses both, and an Admin is invited by level.
 */
export function inviteRoleOptions(
  ceiling: number,
  matrix: { role_id: string | null; name: string | null; base_level: number; ends_at: string | null }[] | undefined,
  now: number = Date.now(),
): InviteRoleOption[] {
  const built = (level: number): InviteRoleOption => ({
    key: `level:${level}`,
    label: roleLabel(level),
    detail: INVITE_ROLES.find((r) => r.level === level)!.detail,
    level,
    roleId: null,
  });
  const own = (matrix ?? [])
    .filter((r) => r.role_id && r.name && r.base_level < TEAM_MANAGE && r.base_level <= ceiling && (!r.ends_at || Date.parse(r.ends_at) > now))
    .map((r): InviteRoleOption => {
      const until = r.ends_at ? new Date(r.ends_at) : null;
      const base = INVITE_ROLES.find((b) => b.level === r.base_level)?.detail ?? 'Menus and where things live';
      return {
        key: `role:${r.role_id}`,
        label: r.name!,
        detail: until ? `${base}, until ${until.getDate()} ${MONTHS[until.getMonth()]}` : base,
        level: r.base_level,
        roleId: r.role_id,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
  return [...AS_ORDER.filter((l) => l <= ceiling).map(built), ...own, ...(TEAM_MANAGE <= ceiling ? [built(TEAM_MANAGE)] : [])];
}

/** Whether what's typed is an email (one @ with something either side), as add_user_to_bar_by_email reads it. */
export function looksLikeEmail(text: string): boolean {
  return /^[^@\s]+@[^@\s]+$/.test(text.trim());
}

/**
 * The welcome message a bar starts with (invite-team-last, call 3): filled
 * in, the Admin's to change. Sent in every invite, signed by the sender.
 */
export function welcomeSuggestion(barName: string): string {
  return `Welcome to ${barName.trim()}. Our specs, menus and prep notes all live in here, so have a look before your first shift. Ask me anything, and see you behind the bar.`;
}

/** The longest welcome message and per-person note the database takes (bars_welcome_message_check, bar_invites_note_check). */
export const WELCOME_MAX = 600;
export const NOTE_MAX = 500;
