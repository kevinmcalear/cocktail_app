/**
 * Why a prep edit matters to the drinks that use it, in a line: asked at Save
 * when other drinks pour the prep (prep-prep-edit-shared). Pure, so
 * lib/prepChange.check.ts runs it without React.
 */

export interface ChangeLine {
  ingredientId: string;
  name: string;
  amount: number | null;
  unit: string | null;
}

const TAIL = 'so every one of them would taste a little different.';

const amount = (l: ChangeLine) => [l.amount ?? '', l.unit ?? ''].join(' ').trim();

/**
 * "Less water, 450 ml instead of 500 ml, so every one of them would taste a
 * little different." One changed line is named; more than one, or lines
 * added or taken out, read as the recipe changing. Null when the lines are
 * the same (a new name or note).
 */
export function changeReason(before: ChangeLine[], after: ChangeLine[]): string | null {
  const was = new Map(before.map((l) => [l.ingredientId, l]));
  const now = new Map(after.map((l) => [l.ingredientId, l]));
  const added = after.filter((l) => !was.has(l.ingredientId));
  const removed = before.filter((l) => !now.has(l.ingredientId));
  const changed = after.filter((l) => {
    const b = was.get(l.ingredientId);
    return !!b && (b.amount !== l.amount || (b.unit ?? '') !== (l.unit ?? ''));
  });
  const count = added.length + removed.length + changed.length;
  if (!count) return null;
  if (count > 1) return `The recipe changes in ${count} places, ${TAIL}`;
  if (added.length) return `Adding ${added[0].name.toLowerCase()} changes it, ${TAIL}`;
  if (removed.length) return `Taking out ${removed[0].name.toLowerCase()} changes it, ${TAIL}`;
  const l = changed[0];
  const b = was.get(l.ingredientId)!;
  const name = l.name.toLowerCase();
  const sameUnit = (b.unit ?? '') === (l.unit ?? '') && b.amount !== null && l.amount !== null;
  const lead = sameUnit ? `${l.amount! < b.amount! ? 'Less' : 'More'} ${name}` : `A new amount of ${name}`;
  return `${lead}, ${amount(l)} instead of ${amount(b)}, ${TAIL}`;
}
