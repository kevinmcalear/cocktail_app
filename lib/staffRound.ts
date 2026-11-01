/**
 * What "Your first round" reads from the bar (board Kept-onboard): your place
 * in a list, the house-made line, your next shift, who set it. Apart from
 * lib/firstRound.ts, which every page loads. Checked by lib/firstRound.check.ts.
 */

import type { FirstRound } from './firstRound';

/** How many of these are read, and the first one that isn't (in their order). */
export function readProgress(round: FirstRound | null, ids: readonly string[]): { read: number; next: string | null } {
  const read = new Set(round?.read ?? []);
  return { read: ids.filter((id) => read.has(id)).length, next: ids.find((id) => !read.has(id)) ?? null };
}

/** "Honey-ginger, grenadine, saline": up to three house-made by name, null for none. */
export function houseMadeLine(names: readonly string[]): string | null {
  return names.slice(0, 3).map((n, i) => (i ? n.charAt(0).toLowerCase() + n.slice(1) : n)).join(', ') || null;
}

export interface RotaShift {
  user_id: string | null;
  starts_at: string;
  ends_at: string;
  opens: boolean;
  closes: boolean;
}

/** Your next shift from now, and who else works it (the shifts that overlap it). */
export function nextShift<S extends RotaShift>(shifts: readonly S[], me: string | null, now: number): { mine: S; others: S[] } | null {
  const mine = shifts.find((s) => !!me && s.user_id === me && Date.parse(s.ends_at) > now);
  if (!mine) return null;
  const start = Date.parse(mine.starts_at);
  const end = Date.parse(mine.ends_at);
  const others = shifts.filter((s) => s !== mine && s.user_id !== me && Date.parse(s.starts_at) < end && Date.parse(s.ends_at) > start);
  return { mine, others };
}

/** "Friday", or "tonight" when the shift starts today (on this phone's clock). */
export function shiftDay(startsAt: string, now: Date): string {
  const at = new Date(startsAt);
  if (at.toDateString() === now.toDateString()) return 'tonight';
  return at.toLocaleDateString('en-US', { weekday: 'long' });
}

/** "Theo opens, you close.": who opens and closes your next shift, or null when the rota doesn't say. */
export function rotaLine(shift: { mine: RotaShift; others: RotaShift[] }, nameOf: (userId: string) => string): string | null {
  const who = (flag: 'opens' | 'closes') => {
    if (shift.mine[flag]) return 'you';
    const other = shift.others.find((s) => s[flag] && s.user_id);
    return other?.user_id ? nameOf(other.user_id) : null;
  };
  const opener = who('opens');
  const closer = who('closes');
  if (opener === 'you' && closer === 'you') return 'You open and close.';
  const parts = [opener ? `${opener} ${opener === 'you' ? 'open' : 'opens'}` : null, closer ? `${closer} ${closer === 'you' ? 'close' : 'closes'}` : null].filter((p): p is string => !!p);
  if (!parts.length) return null;
  const line = parts.join(', ');
  return `${line.charAt(0).toUpperCase()}${line.slice(1)}.`;
}

/**
 * Who set the round for new bartenders: the bar's Admin who has been there
 * longest (never you). Null says "Your bar set these".
 * ponytail: the round is the same three things at every bar, so this names
 * the bar's lead Admin rather than someone who picked them. Upgrade path: a
 * per-bar round with its own set_by, if bars start writing their own.
 */
export function roundSetter<M extends { user_id: string; role_level: number; display_name?: string | null; joined_at?: string | null }>(members: readonly M[], me: string | null, adminLevel: number): string | null {
  const admins = members.filter((m) => m.user_id !== me && m.role_level >= adminLevel && !!m.display_name?.trim());
  admins.sort((a, b) => b.role_level - a.role_level || (a.joined_at ?? '').localeCompare(b.joined_at ?? ''));
  return admins[0]?.display_name?.trim() ?? null;
}

/** "Ana Ruiz" -> "Ana". */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
