// A venue drink's service notes (item_service_notes, 20261014210000): how
// the garnish goes on, the hand-off in steps, and what the floor says about
// it. Plain JSON, since the query cache is persisted.

export interface ServiceNotes {
  /** "Candied ginger on a pick, laid across the rim." */
  garnish: string | null;
  /** The hand-off, one step per entry. */
  handoff: string[];
  talkingPoint: string | null;
  sellItAs: string | null;
}

/** As many hand-off steps as the database keeps. */
export const MAX_HANDOFF_STEPS = 8;

export const EMPTY_SERVICE_NOTES: ServiceNotes = { garnish: null, handoff: [], talkingPoint: null, sellItAs: null };

/** Whether there's anything to show. */
export const hasServiceNotes = (n: ServiceNotes | null | undefined): n is ServiceNotes =>
  !!n && (!!n.garnish || n.handoff.length > 0 || !!n.talkingPoint || !!n.sellItAs);

/** Whether the floor's part (talking point, sell it as) has anything. */
export const hasTalkingPoints = (n: ServiceNotes | null | undefined): n is ServiceNotes => !!n && (!!n.talkingPoint || !!n.sellItAs);

/** Trimmed, blanks as null, empty hand-off steps dropped, at most eight. */
export function cleanServiceNotes(n: ServiceNotes): ServiceNotes {
  const text = (s: string | null) => (s?.trim() ? s.trim() : null);
  return {
    garnish: text(n.garnish),
    handoff: n.handoff.map((s) => s.trim()).filter(Boolean).slice(0, MAX_HANDOFF_STEPS),
    talkingPoint: text(n.talkingPoint),
    sellItAs: text(n.sellItAs),
  };
}

/** The hand-off as typed in one box, a step per line, and back. */
export const handoffText = (steps: string[]) => steps.join('\n');
export const handoffSteps = (text: string) => text.split('\n');
