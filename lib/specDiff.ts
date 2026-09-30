/**
 * What changed between two versions of a drink, in plain words: "Demerara
 * 7.5 → 6 g", "+ 1 dash Saline", "− Orange bitters", "Method Stir → Shake".
 * Reads the snapshots private.drink_snapshot writes. Pure.
 */

export interface SnapshotLine {
  ingredient_item_id: string | null;
  name: string | null;
  amount: number | string | null;
  unit: string | null;
  note: string | null;
  optional: boolean;
  at_service: boolean | null;
}

export interface Snapshot {
  lines: SnapshotLine[];
  methods: string[];
  method_ids?: string[];
  glass: string | null;
  ice: string | null;
  notes: string | null;
  dilution_pct: number | null;
  service_style: string | null;
}

const ARROW = '→';

function amountOf(l: SnapshotLine): string {
  const n = l.amount === null || l.amount === '' ? null : Number(l.amount);
  if (n === null || Number.isNaN(n)) return l.unit ?? '';
  return [String(Number(n.toFixed(3))), l.unit].filter(Boolean).join(' ');
}

const name = (l: SnapshotLine) => l.name ?? 'Hidden ingredient';
const key = (l: SnapshotLine) => l.ingredient_item_id ?? `name:${l.name}`;

/** Plain-language lines describing how `next` differs from `prev`; empty when nothing changed. */
export function specDiff(prev: Snapshot | null, next: Snapshot): string[] {
  const out: string[] = [];
  if (!prev) {
    out.push(...next.lines.map((l) => `+ ${[amountOf(l), name(l)].filter(Boolean).join(' ')}`));
    return out;
  }
  const before = new Map(prev.lines.map((l) => [key(l), l]));
  const after = new Map(next.lines.map((l) => [key(l), l]));
  for (const l of next.lines) {
    const was = before.get(key(l));
    if (!was) {
      out.push(`+ ${[amountOf(l), name(l)].filter(Boolean).join(' ')}`);
      continue;
    }
    const a = amountOf(was);
    const b = amountOf(l);
    if (a !== b) out.push(`${name(l)} ${a || 'no amount'} ${ARROW} ${b || 'no amount'}`);
    if ((was.note ?? '') !== (l.note ?? '')) out.push(`${name(l)}: prep note ${l.note ? 'changed' : 'removed'}`);
    if (!!was.optional !== !!l.optional) out.push(`${name(l)} ${l.optional ? 'now optional' : 'no longer optional'}`);
  }
  for (const l of prev.lines) if (!after.has(key(l))) out.push(`− ${name(l)}`);
  const methodA = prev.methods.join(', ');
  const methodB = next.methods.join(', ');
  if (methodA !== methodB) out.push(`Method ${methodA || 'none'} ${ARROW} ${methodB || 'none'}`);
  if ((prev.glass ?? '') !== (next.glass ?? '')) out.push(`Glass ${prev.glass ?? 'none'} ${ARROW} ${next.glass ?? 'none'}`);
  if ((prev.ice ?? '') !== (next.ice ?? '')) out.push(`Ice ${prev.ice ?? 'none'} ${ARROW} ${next.ice ?? 'none'}`);
  if ((prev.notes ?? '') !== (next.notes ?? '')) out.push(next.notes ? 'Bartender notes changed' : 'Bartender notes removed');
  if ((prev.dilution_pct ?? null) !== (next.dilution_pct ?? null)) out.push(`Dilution ${prev.dilution_pct ?? 'default'} ${ARROW} ${next.dilution_pct ?? 'default'}`);
  if ((prev.service_style ?? '') !== (next.service_style ?? '')) out.push(`Service ${prev.service_style ?? 'unset'} ${ARROW} ${next.service_style ?? 'unset'}`);
  return out;
}

/** "11 Aug · Theo P." */
export function versionLine(createdAt: string, by: string | null): string {
  const date = new Date(createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return [date, by].filter(Boolean).join(' · ');
}
