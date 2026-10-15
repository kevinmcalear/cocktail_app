/**
 * Undo and redo for an edit in place (the drink page's Editing toolbar).
 * A burst of changes (typing a name) is one step: `record` with `burst`
 * false folds into the step already open. Pure; checked by
 * lib/editHistory.check.ts.
 */
export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

/** How many steps back undo goes. */
const DEPTH = 50;

export const startHistory = <T>(present: T): History<T> => ({ past: [], present, future: [] });

/** A change: a new step (or folded into the open one), and redo forgets what was undone. */
export function record<T>(h: History<T>, next: T, newStep: boolean): History<T> {
  return { past: newStep ? [...h.past, h.present].slice(-DEPTH) : h.past, present: next, future: [] };
}

export function undo<T>(h: History<T>): History<T> {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
}

export function redo<T>(h: History<T>): History<T> {
  if (!h.future.length) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
}
