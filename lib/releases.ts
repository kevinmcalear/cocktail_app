/**
 * A bar's releases ("Autumn release, 1 March"): named, dated sets of its
 * drinks. A release is a draft until published_at is set, and public from
 * that moment, so it can be scheduled. The database enforces the rules
 * (private.guard_release_publish); these say them before saving.
 */

export type ReleaseStatus = 'draft' | 'scheduled' | 'live' | 'hidden';

export const RELEASE_STATUS_LABEL: Record<ReleaseStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  live: 'Live',
  hidden: 'Hidden by a moderator',
};

export function releaseStatus(r: { publishedAt: string | null; moderatedAt: string | null }, now: number): ReleaseStatus {
  if (r.moderatedAt) return 'hidden';
  if (!r.publishedAt) return 'draft';
  return Date.parse(r.publishedAt) > now ? 'scheduled' : 'live';
}

const pad = (n: number) => String(n).padStart(2, '0');

/** A local date as "2026-12-01". */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "2026-12-01" as the start of that day, local time. Null for anything that isn't a real date. */
export function dayStart(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00`);
  // new Date rolls 2026-02-31 over into March; a real date reads back the same.
  return Number.isNaN(d.getTime()) || ymd(d) !== value ? null : d;
}

/** What stops a release from going public, in words. Empty when it can. */
export function releaseProblems(r: { name: string; releaseDate: string; drinks: { name: string; isPublic: boolean }[] }): string[] {
  const problems: string[] = [];
  if (!r.name.trim()) problems.push('Give it a name.');
  if (!dayStart(r.releaseDate)) problems.push('Pick a release date.');
  if (!r.drinks.length) problems.push('Add at least one drink.');
  const hidden = r.drinks.filter((d) => !d.isPublic).map((d) => d.name);
  if (hidden.length) problems.push(`Publish ${hidden.join(', ')} first, or take ${hidden.length === 1 ? 'it' : 'them'} out.`);
  return problems;
}
