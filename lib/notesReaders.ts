import { roleLabel } from '@/lib/roles';

/**
 * Who reads a drink's notes (20261122300000_notes_by_role): null is everyone
 * who sees the drink; a venue role level is that role and everyone above it.
 */
export type NotesLevel = 20 | 30 | 35 | 40 | null;

export const NOTES_LEVELS = [20, 30, 35, 40] as const;

/** One of the venue's roles, as the roles matrix has it: a built-in level when `name` is null. */
export interface VenueRoleName {
  name: string | null;
  base_level: number;
  ends_at: string | null;
}

export interface NotesReaderOption {
  level: NotesLevel;
  label: string;
  detail: string;
}

const LABELS: Record<(typeof NOTES_LEVELS)[number], string> = {
  20: 'Employees and up',
  30: 'Bartenders and up',
  35: 'Drink Creators and up',
  40: 'Admins',
};

/** A role level's row name, for saying the pick back ("Bartenders and up"). */
export function notesLevelLabel(level: Exclude<NotesLevel, null>): string {
  return LABELS[level];
}

/** Past this many names a row says its own level's and "and everyone above". */
const MAX_NAMES = 5;

/**
 * "Who reads the notes?" at a venue (E29, option A): everyone, then each
 * level with the venue's own role names at it and above (a role that has
 * ended is left out), then Admins by name when the team is known.
 */
export function notesReaderOptions(roles: readonly VenueRoleName[], adminNames: readonly string[], now = Date.now()): NotesReaderOption[] {
  const live = roles.filter((r) => !r.ends_at || Date.parse(r.ends_at) > now);
  // The built-in name first, then the venue's own roles at that level, A to Z.
  const namesAt = (level: number) => [
    roleLabel(level),
    ...live
      .filter((r) => r.name && r.base_level === level)
      .map((r) => r.name!)
      .sort((a, b) => a.localeCompare(b)),
  ];
  const levels = NOTES_LEVELS.map((level) => {
    if (level === 40 && adminNames.length) return { level, label: LABELS[level], detail: someNames([...new Set(adminNames)]) };
    const all = NOTES_LEVELS.filter((l) => l >= level).flatMap(namesAt);
    const detail = all.length > MAX_NAMES ? `${namesAt(level).join(', ')}, and everyone above` : all.join(', ');
    return { level, label: LABELS[level], detail };
  });
  return [{ level: null, label: 'Everyone who sees the drink', detail: 'Guests and staff, and the public if it is published' }, ...levels];
}

/** A venue's Admins by name, the first few and how many more. */
function someNames(names: string[]): string {
  if (names.length <= MAX_NAMES) return names.join(', ');
  return `${names.slice(0, MAX_NAMES - 1).join(', ')} and ${names.length - MAX_NAMES + 1} more`;
}
