// The handover note (Loop-handover, decided 1 Nov 2026: one note per close).
// Each person's row for a close holds what they wrote and when they read it
// (handover_notes); these put the rows back together as one note. Plain
// functions so handover.check.ts can hold them.

export interface HandoverRow {
  close_date: string;
  user_id: string;
  ran_out: string[];
  note: string | null;
  prep: string | null;
  broken: string | null;
  written_at: string | null;
  read_at: string | null;
}

/** A line of the note: "Honey-ginger syrup" with "One batch" under it. */
export interface HandoverLine {
  name: string;
  sub: string | null;
}

/** One close's note: who wrote it, in the order they wrote, and who has read it. */
export interface HandoverNote {
  closeDate: string;
  writers: HandoverRow[];
  ranOut: string[];
  prep: HandoverLine[];
  broken: HandoverLine[];
  /** People who read it without writing (the writers read it as they wrote it). */
  readers: string[];
}

const written = (r: HandoverRow) => !!r.written_at;

/** A close's rows as one note, or null when nobody wrote anything for it. */
export function noteFor(rows: readonly HandoverRow[], closeDate: string): HandoverNote | null {
  const all = rows.filter((r) => r.close_date === closeDate);
  const writers = all.filter(written).sort((a, b) => a.written_at!.localeCompare(b.written_at!));
  if (!writers.length) return null;
  return {
    closeDate,
    writers,
    ranOut: unique(writers.flatMap((w) => w.ran_out)),
    prep: writers.flatMap((w) => lines(w.prep)),
    broken: writers.flatMap((w) => lines(w.broken)),
    readers: all.filter((r) => r.read_at && !written(r)).map((r) => r.user_id),
  };
}

/** The last close before tonight with a note: what whoever opens tonight reads. */
export function lastNote(rows: readonly HandoverRow[], tonight: string): HandoverNote | null {
  const days = [...new Set(rows.filter((r) => written(r) && r.close_date < tonight).map((r) => r.close_date))].sort().reverse();
  return days.length ? noteFor(rows, days[0]) : null;
}

/** Whether the note still sits on top of Tonight for this person: they haven't read it, and didn't write it. */
export function isUnread(note: HandoverNote | null, rows: readonly HandoverRow[], me: string | null): boolean {
  if (!note || !me) return false;
  return !rows.some((r) => r.close_date === note.closeDate && r.user_id === me && (r.read_at || r.written_at));
}

/** Each line of a field is a row; words after its first comma go under it, capitalised. */
export function lines(text: string | null): HandoverLine[] {
  return (text ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const at = l.indexOf(',');
      if (at < 0) return { name: l, sub: null };
      const sub = l.slice(at + 1).trim();
      return { name: l.slice(0, at).trim(), sub: sub ? sub.charAt(0).toUpperCase() + sub.slice(1) : null };
    });
}

/** "Ana", "Ana and Theo", "Ana, Theo and Maya". */
export function names(list: readonly string[]): string {
  if (list.length <= 1) return list[0] ?? '';
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

/** The card on top of Tonight: "Ran out of Grenadine. Honey-ginger syrup needs doing. Ice well drains slowly." */
export function summary(note: HandoverNote): string {
  const parts = [
    note.ranOut.length ? `Ran out of ${names(note.ranOut)}.` : null,
    note.prep[0] ? `${note.prep[0].name} needs doing.` : null,
    note.broken[0] ? `${note.broken[0].name.replace(/[.!]$/, '')}.` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' ') : (note.writers.find((w) => w.note)?.note ?? '');
}

/** "Read by you, Theo and Maya." Readers first-named, you first. */
export function readByLine(readers: readonly string[], me: string | null, nameOf: (id: string) => string): string | null {
  if (!readers.length) return null;
  const ordered = [...readers.filter((id) => id === me), ...readers.filter((id) => id !== me)];
  return `Read by ${names(ordered.map((id) => (id === me ? 'you' : nameOf(id).split(' ')[0])))}`;
}

/**
 * Under something that ran out, the drinks on tonight's lists that use it:
 * "Last Word is off until it comes", "Bijou and Last Word are off until it
 * comes". Names match ignoring case. Null when nothing on tonight uses it.
 */
export function ranOutLine(item: string, drinks: readonly { name: string; uses: readonly string[] }[]): string | null {
  const hit = drinks.filter((d) => d.uses.some((u) => key(u) === key(item))).map((d) => d.name);
  const list = [...new Set(hit)].sort((a, b) => a.localeCompare(b));
  if (!list.length) return null;
  return `${names(list)} ${list.length === 1 ? 'is' : 'are'} off until it comes`;
}

/** What ran out, to tap: house-made on tonight's lists and what ran out lately, then anything picked that isn't among them. Case-insensitive, and a picked spelling wins so its chip shows picked; the order holds still as chips are picked. */
export function ranOutChoices(houseMade: readonly string[], lately: readonly string[], picked: readonly string[], max = 8): string[] {
  const spelled = (s: string) => picked.find((p) => key(p) === key(s)) ?? s;
  return unique([...unique([...houseMade, ...lately]).slice(0, max), ...picked]).map(spelled);
}

const key = (s: string) => s.trim().toLowerCase();

function unique(list: readonly string[]): string[] {
  const seen = new Set<string>();
  return list.filter((s) => {
    const k = key(s);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
