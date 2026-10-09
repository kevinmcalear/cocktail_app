// What a classic's row and a bar's variation say in My Bar's What to make
// (my_bar_drinks, supabase/migrations/20261011120000_my_bar_served_at.sql).

/** A bar pouring the classic as it is. */
export interface ServedBar {
  name: string;
  logo: string | null;
}

/** What a bar's version changes, named as the caller sees the spec (public.spec_matches). */
export interface SpecNote {
  swaps?: { to: string; from: string; base?: boolean }[];
  adds?: { name: string; house?: boolean }[];
  drops?: string[];
  measures?: boolean;
}

/** "Served at Harry's Bar", "Served at Harry's Bar and The Gold Room", "Served at Harry's Bar, The Gold Room +5". */
export function servedCaption(count: number, bars: ServedBar[]): string | undefined {
  const names = bars.slice(0, 2).map((b) => b.name);
  if (!names.length || count < 1) return undefined;
  if (count === 1) return `Served at ${names[0]}`;
  if (count === 2 && names.length === 2) return `Served at ${names[0]} and ${names[1]}`;
  const rest = count - names.length;
  return `Served at ${names.join(', ')}${rest > 0 ? ` +${rest}` : ''}`;
}

/** "uses Rye Whiskey, not Bourbon; adds Mezcal and a house Honey Butter; no Campari", in the spec's own names. */
export function specNoteText(note: SpecNote | null | undefined): string | undefined {
  if (!note) return undefined;
  const parts: string[] = [];
  for (const s of note.swaps ?? []) parts.push(`uses ${s.to}, not ${s.from}`);
  const adds = (note.adds ?? []).map((a) => (a.house ? `a house ${a.name}` : a.name));
  if (adds.length) parts.push(`adds ${list(adds)}`);
  if (note.drops?.length) parts.push(`no ${list(note.drops)}`);
  if (note.measures) parts.push('different measures');
  return parts.length ? parts.join('; ') : undefined;
}

function list(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * A classic's bar versions sorted by their verdicts: the bars pouring it as it
 * is (one per bar), the variations, and the rest as riffs. A version with no
 * verdict yet is a riff, as "Bars' versions" read before.
 */
export function splitVersions<T extends { id: string; barId?: string | null }>(
  versions: T[],
  verdict: (id: string) => string | undefined
): { served: T[]; variations: T[]; riffs: T[] } {
  const served: T[] = [];
  const variations: T[] = [];
  const riffs: T[] = [];
  const bars = new Set<string>();
  for (const v of versions) {
    const m = verdict(v.id);
    if (m === 'same' || m === 'unlisted') {
      const bar = v.barId ?? v.id;
      if (!bars.has(bar)) served.push(v);
      bars.add(bar);
    } else if (m === 'variation') variations.push(v);
    else riffs.push(v);
  }
  return { served, variations, riffs };
}

/** What a bar's drink is to its classic, for a row's caption: "the classic spec", or what its variation changes. */
export function versionLabel(match: { spec_match: string; notes?: SpecNote | null } | null | undefined): string | undefined {
  if (match?.spec_match === 'same') return 'the classic spec';
  if (match?.spec_match === 'variation') return specNoteText(match.notes) ?? 'a variation';
  return undefined;
}

/**
 * Search: bars' drinks that are a classic shown in the same results fold into
 * it. Returns the drinks still listed, and for each classic the bars that pour
 * it as it is, in the results' order.
 */
export function foldIntoClassics<T extends { id: string; bar: ServedBar }>(
  drinks: T[],
  classicIds: ReadonlySet<string>,
  match: (id: string) => { spec_match: string; classic_id: string } | undefined
): { drinks: T[]; servedBy: Record<string, ServedBar[]> } {
  const kept: T[] = [];
  const servedBy: Record<string, ServedBar[]> = {};
  for (const d of drinks) {
    const m = match(d.id);
    if (m && (m.spec_match === 'same' || m.spec_match === 'unlisted') && classicIds.has(m.classic_id)) {
      const bars = (servedBy[m.classic_id] ??= []);
      if (!bars.some((b) => b.name === d.bar.name)) bars.push(d.bar);
    } else kept.push(d);
  }
  return { drinks: kept, servedBy };
}
