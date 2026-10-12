import { roleLabel } from '@/lib/roles';

/**
 * Roles and access: the capabilities a venue role can have (the database's
 * venue_capability enum), in the groups and words the canvas draws. Level-bound
 * ones follow the base level and can't be changed per role (the database
 * refuses it), so they show a lock and no switch.
 */
export interface CapabilityRow {
  id: string;
  label: string;
  /** The words after "plus" or "no" in a role's summary: "house-made recipes". */
  short: string;
  detail?: string;
  levelBound?: boolean;
}

export const CAPABILITY_GROUPS: { title: string; rows: CapabilityRow[] }[] = [
  {
    title: 'Seeing',
    rows: [
      { id: 'menu', label: 'Menu and descriptions', short: 'the menu', levelBound: true },
      { id: 'talking_points', label: 'Talking points and allergens', short: 'talking points' },
      { id: 'specs', label: 'Specs', short: 'specs', levelBound: true },
      { id: 'house_made', label: 'House-made recipes', short: 'house-made recipes' },
      { id: 'locations', label: 'Where things live', short: 'where things live', detail: 'The back bar map' },
      { id: 'costs', label: 'Costs and pour cost', short: 'costs' },
    ],
  },
  {
    title: 'Making',
    rows: [
      { id: 'edit_drinks', label: 'Create and edit drinks', short: 'drink edits', levelBound: true },
      { id: 'prep', label: 'Prep list and orders', short: 'prep', detail: 'Also places items on the back bar' },
      { id: 'photos', label: 'Take and replace photos', short: 'photos' },
      { id: 'menus', label: 'Build menus and events', short: 'menus', levelBound: true },
    ],
  },
  {
    title: 'Running the venue',
    rows: [
      { id: 'publish', label: 'Publish to the public app', short: 'publishing' },
      { id: 'staff', label: 'Invite and manage staff', short: 'staff', levelBound: true },
      { id: 'brand', label: 'Edit brand', short: 'brand', levelBound: true },
    ],
  },
];

const ROWS = CAPABILITY_GROUPS.flatMap((g) => g.rows);
/** The capabilities a role can grant or take away. */
export const OVERRIDABLE = ROWS.filter((r) => !r.levelBound).map((r) => r.id);

/** The bits of a matrix row this needs (useRoleMatrix's RoleMatrixRow). */
export interface MatrixColumn {
  role_id: string | null;
  name: string | null;
  base_level: number;
  ends_at: string | null;
  granted: string[];
  revoked: string[];
  capabilities: string[];
}

/** What a cell shows: can, can't, and whether a venue role changed it from its base level. */
export interface Cell {
  can: boolean;
  changed: boolean;
}

/** The base level's capabilities at this venue, from the matrix's own base rows. */
export function baseCapabilities(matrix: MatrixColumn[], level: number): string[] {
  return matrix.find((c) => c.role_id === null && c.base_level === level)?.capabilities ?? [];
}

export function cell(matrix: MatrixColumn[], column: MatrixColumn, capability: string): Cell {
  const can = column.capabilities.includes(capability);
  const changed = column.role_id !== null && can !== baseCapabilities(matrix, column.base_level).includes(capability);
  return { can, changed };
}

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

/**
 * The overrides to save for a role on `level` with these capabilities switched
 * on: granted is what the base level lacks, revoked what it has and the role
 * doesn't. Level-bound capabilities are never overridden.
 */
export function overridesFor(baseCaps: string[], on: string[]): { granted: string[]; revoked: string[] } {
  const granted = OVERRIDABLE.filter((c) => on.includes(c) && !baseCaps.includes(c));
  const revoked = OVERRIDABLE.filter((c) => !on.includes(c) && baseCaps.includes(c));
  return { granted, revoked };
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
