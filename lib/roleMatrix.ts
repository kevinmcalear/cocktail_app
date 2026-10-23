import { roleLabel } from '@/lib/roles';
import type { Enum } from '@/types/db';

/** A permission, as the database names it. */
export type Capability = Enum<'venue_capability'>;

/**
 * Roles and access: the permissions a venue role can have (the database's
 * venue_capability enum), in the groups and words the canvas draws. Every
 * one can be switched for any role at a venue, built-in roles included,
 * except that an Admin always keeps staff (the database refuses it), so a
 * venue can't lock itself out.
 */
export interface CapabilityRow {
  id: Capability;
  label: string;
  /** The words after "plus" or "no" in a role's summary: "house-made recipes". */
  short: string;
  /** The words after "can now" in the Undo toast: "invite and manage staff". */
  can: string;
  detail?: string;
}

export const CAPABILITY_GROUPS: { title: string; rows: CapabilityRow[] }[] = [
  {
    title: 'Seeing',
    rows: [
      { id: 'menu', label: 'Menu and descriptions', short: 'the menu', can: 'see the menu and descriptions' },
      { id: 'talking_points', label: 'Talking points and allergens', short: 'talking points', can: 'see talking points and allergens' },
      { id: 'specs', label: 'Specs', short: 'specs', can: 'see specs' },
      { id: 'house_made', label: 'House-made recipes', short: 'house-made recipes', can: 'see house-made recipes' },
      { id: 'locations', label: 'Where things live', short: 'where things live', can: 'see where things live', detail: 'The back bar map' },
      { id: 'costs', label: 'Costs and pour cost', short: 'costs', can: 'see costs and pour cost' },
    ],
  },
  {
    title: 'Making',
    rows: [
      { id: 'edit_drinks', label: 'Create and edit drinks', short: 'drink edits', can: 'create and edit drinks' },
      { id: 'prep', label: 'Prep list and orders', short: 'prep', can: 'do the prep list and orders', detail: 'Also places items on the back bar' },
      { id: 'photos', label: 'Take and replace photos', short: 'photos', can: 'take and replace photos' },
      { id: 'menus', label: 'Build menus and events', short: 'menus', can: 'build menus and events' },
    ],
  },
  {
    title: 'Running the venue',
    rows: [
      { id: 'publish', label: 'Publish to the public app', short: 'publishing', can: 'publish to the public app' },
      { id: 'staff', label: 'Invite and manage staff', short: 'staff', can: 'invite and manage staff' },
      { id: 'brand', label: 'Edit brand', short: 'brand', can: 'edit brand' },
    ],
  },
];

const ADMIN = 40;
const ROWS = CAPABILITY_GROUPS.flatMap((g) => g.rows);
/** Every permission, in the table's order. */
export const CAPABILITIES = ROWS.map((r) => r.id);

export const isCapability = (s: string): s is Capability => CAPABILITIES.some((c) => c === s);

/** A plain permission name as the database's enum; an unknown one is a bug, so it throws rather than saving less. */
export function toCapability(s: string): Capability {
  if (!isCapability(s)) throw new Error(`Unknown permission: ${s}`);
  return s;
}

/** The bits of a matrix row this needs (useRoleMatrix's RoleMatrixRow). */
export interface MatrixColumn {
  role_id: string | null;
  name: string | null;
  base_level: number;
  ends_at: string | null;
  granted: string[];
  revoked: string[];
  capabilities: string[];
  /** What it could do before anyone changed it (the built-in role). Older servers leave it out. */
  starts_with?: string[];
}

/** What a cell shows: can, can't, and whether it changed from where the role started. */
export interface Cell {
  can: boolean;
  changed: boolean;
}

/** An Admin always keeps staff, so a venue can't lock itself out. */
export function isLocked(column: Pick<MatrixColumn, 'base_level'>, capability: string): boolean {
  return column.base_level >= ADMIN && capability === 'staff';
}

/** A built-in role's permissions at this venue before anyone changed them, from the matrix's own rows. */
export function baseCapabilities(matrix: MatrixColumn[], level: number): string[] {
  const row = matrix.find((c) => c.role_id === null && c.base_level === level);
  return row?.starts_with ?? row?.capabilities ?? [];
}

export function cell(matrix: MatrixColumn[], column: MatrixColumn, capability: string): Cell {
  const can = column.capabilities.includes(capability);
  const start = column.starts_with ?? (column.role_id ? baseCapabilities(matrix, column.base_level) : column.capabilities);
  return { can, changed: can !== start.includes(capability) };
}

/** A built-in role this venue has changed, so it offers Reset to built in. */
export function isChangedBuiltIn(column: MatrixColumn): boolean {
  return column.role_id === null && column.granted.length + column.revoked.length > 0;
}

/** The Undo toast: "Head bartender can now invite and manage staff". */
export function toggleLine(roleName: string, capability: string, on: boolean): string {
  const words = ROWS.find((r) => r.id === capability)?.can ?? capability;
  return `${roleName} ${on ? 'can now' : 'can no longer'} ${words}`;
}

/** A matrix with one permission switched for one column, as the server will work it out. */
export function withToggle<T extends MatrixColumn>(matrix: T[], column: Pick<MatrixColumn, 'role_id' | 'base_level'>, capability: string, on: boolean): T[] {
  return matrix.map((c) => {
    if (c.role_id !== column.role_id || (c.role_id === null && c.base_level !== column.base_level)) return c;
    const capabilities = on ? [...new Set([...c.capabilities, capability])] : c.capabilities.filter((x) => x !== capability);
    const start = c.starts_with ?? (c.role_id ? baseCapabilities(matrix, c.base_level) : c.capabilities);
    return { ...c, starts_with: start, capabilities, ...overridesFor(start, capabilities) };
  });
}

/**
 * New role starts from a ready-made one (board fix 14): a built-in role with
 * some permissions switched. `ends`: a takeover ends on a date.
 */
export interface RolePreset {
  id: string;
  name: string;
  base_level: number;
  /** Its permissions, given the built-in role's at this venue. */
  on: (base: string[]) => string[];
  ends?: boolean;
}

export const ROLE_PRESETS: RolePreset[] = [
  { id: 'apprentice', name: 'Apprentice', base_level: 20, on: (base) => [...new Set([...base, 'specs', 'prep'])] },
  { id: 'head', name: 'Head bartender', base_level: 35, on: (base) => [...new Set([...base, 'staff', 'publish'])] },
  { id: 'takeover', name: 'Takeover bartender', base_level: 30, on: () => ['menu', 'specs', 'locations'], ends: true },
];

function list(ids: string[]): string {
  const words = ids.map((id) => ROWS.find((r) => r.id === id)?.short ?? id);
  if (words.length < 2) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/** "From Employee, plus house-made recipes and prep", "From Bartender, no photos". */
export function roleSummary(role: Pick<MatrixColumn, 'base_level' | 'granted' | 'revoked'>): string {
  const parts = [`From ${roleLabel(role.base_level)}`];
  if (role.granted.length) parts.push(`plus ${list(role.granted)}`);
  if (role.revoked.length) parts.push(`no ${list(role.revoked)}`);
  return parts.join(', ');
}

/** The words under a column's name: "Built in", "Yours · from Employee", "Yours · ends Mon 12 Oct". Never a level number. */
export function columnCaption(column: Pick<MatrixColumn, 'role_id' | 'base_level' | 'ends_at'>): string {
  if (!column.role_id) return 'Built in';
  const ends = endsLabel(column.ends_at);
  return `Yours · ${ends ? `ends ${ends}` : `from ${roleLabel(column.base_level)}`}`;
}

/**
 * The overrides to save for a role on `level` with these permissions switched
 * on: granted is what the built-in role lacks, revoked what it has and the
 * role doesn't.
 */
export function overridesFor(baseCaps: string[], on: string[]): { granted: string[]; revoked: string[] } {
  const granted = CAPABILITIES.filter((c) => on.includes(c) && !baseCaps.includes(c));
  const revoked = CAPABILITIES.filter((c) => !on.includes(c) && baseCaps.includes(c));
  return { granted, revoked };
}

/**
 * Someone with staff who isn't an Admin hands out only what they can do
 * themselves (the database's guards). `mine`: their permissions, or null for
 * an Admin, who isn't limited. `keep`: what the role already has, which may
 * stay.
 */
export function withinReach(caps: string[], mine: string[] | null, keep: string[] = []): boolean {
  return !mine || caps.every((c) => mine.includes(c) || keep.includes(c));
}

/** `caps` cut down to what they may hand out (see withinReach). */
export function limitTo(caps: string[], mine: string[] | null, keep: string[] = []): string[] {
  return mine ? caps.filter((c) => withinReach([c], mine, keep)) : caps;
}

/**
 * The highest built-in role (at or under `ceiling`) they may give someone:
 * every built-in role up to it does no more than they can.
 */
export function reachCeiling(matrix: MatrixColumn[], mine: string[] | null, ceiling: number): number {
  if (!mine) return ceiling;
  let reach = 0;
  for (const level of [10, 20, 30, 35, 40]) {
    if (level > ceiling || !withinReach(baseCapabilities(matrix, level), mine)) break;
    reach = level;
  }
  return reach;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sun 12 Oct", in the device's time zone (when a guest's access ends there). */
export function dayLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Sun 12 Oct": the last day a guest has access (their role ends at the midnight after it). */
export function endsLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return dayLabel(new Date(new Date(iso).getTime() - 1).toISOString());
}

/** The end of a picked day (2026-10-12) in the device's zone: guest staff keep that whole night. */
export function endOfDay(day: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1).toISOString();
}

/** The day (2026-10-12) a saved end lands on, for the date field: the inverse of endOfDay. */
export function dayOfEnd(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() - 1);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today (2026-10-12) in the device's zone: a takeover's default last day. */
export function today(now: number): string {
  return dayOfEnd(new Date(now + 1).toISOString());
}
