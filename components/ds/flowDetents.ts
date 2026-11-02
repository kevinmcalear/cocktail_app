import type { PresentationDetent } from '@expo/ui/swift-ui/modifiers';

/** Lowest and highest a flow may rest part-way: under this it's a small sheet, over it it's the full one. */
const LOWEST = 0.3;
const HIGHEST = 0.9;

/**
 * Where an iOS flow sheet rests and where it can be dragged. Part-way (the
 * first step of Add and Rank it, Prod-rank-A 1 and Prod-motion-sheet 3): rests
 * at that share of the screen, the system's floating inset sheet, and can be
 * pulled up to full. Without it (the steps after, Theme's sheets): full
 * height only, so dropping `part` grows the sheet.
 */
export function flowDetents(part: number | undefined): { detents: PresentationDetent[]; rest: PresentationDetent } {
  if (part === undefined || !Number.isFinite(part)) return { detents: ['large'], rest: 'large' };
  const fraction = Math.min(HIGHEST, Math.max(LOWEST, part));
  const rest: PresentationDetent = { fraction };
  return { detents: [rest, 'large'], rest };
}
