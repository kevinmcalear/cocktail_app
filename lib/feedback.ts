/**
 * Notes people send from inside the app (the feedback table): "Doing
 * something different? Tell us" and Report a problem. Each one carries where
 * it came from, so we can find the screen and add what they do.
 */

/** 'different': we do it differently. The rest are Report a problem's kinds. */
export type FeedbackKind = 'different' | 'broken' | 'wrong' | 'slow' | 'data' | 'other';
export type ProblemKind = Exclude<FeedbackKind, 'different'>;

/** Report a problem's kinds, in the board's order and words. */
export const PROBLEM_KINDS: readonly { id: ProblemKind; label: string }[] = [
  { id: 'broken', label: 'Something’s broken' },
  { id: 'wrong', label: 'Looks wrong' },
  { id: 'slow', label: 'It’s slow' },
  { id: 'data', label: 'Wrong information' },
  { id: 'other', label: 'Something else' },
];

/** The table's limits: characters in a note, notes a person a day. */
export const FEEDBACK_MAX = 2000;
export const FEEDBACK_DAILY_LIMIT = 20;

/** Where a note came from. */
export interface FeedbackPlace {
  /** In words: "Adding a drink › Ice". */
  screen: string;
  /** What it's about there: the drink being added, the bottle being made house. */
  subject?: string | null;
  /** The bar they were working at, if any. */
  barId?: string | null;
  barName?: string | null;
}

/** "Adding a drink › Ice · Ash Garden · Little Rye": what the sheet says it sends. */
export function sentWithLine(place: FeedbackPlace, device = false): string {
  const parts = [place.screen, place.subject?.trim(), place.barId ? place.barName?.trim() : null, device ? 'app version and device' : null];
  return parts.filter(Boolean).join(' · ');
}

/** "App 1.5.0 on ios 26.1". The web reports no real version ("0.0.0"), so none is shown. */
export function deviceLine(version: string | null | undefined, os: string, osVersion: string | number | null | undefined): string {
  const v = osVersion == null || String(osVersion) === '0.0.0' ? '' : String(osVersion);
  return `App ${version || 'unknown'} on ${os} ${v}`.trim();
}

export interface FeedbackRow {
  kind: FeedbackKind;
  screen: string;
  route: string | null;
  subject: string | null;
  bar_id: string | null;
  body: string;
  device: string;
}

const clip = (s: string | null | undefined, max: number) => {
  const t = s?.trim();
  return t ? t.slice(0, max) : null;
};

/** The row to insert: trimmed and cut to the table's limits. */
export function feedbackRow(kind: FeedbackKind, body: string, place: FeedbackPlace, route: string | null, device: string): FeedbackRow {
  return {
    kind,
    screen: clip(place.screen, 200) ?? 'Somewhere in the app',
    route: clip(route, 300),
    subject: clip(place.subject, 200),
    bar_id: place.barId ?? null,
    body: body.trim().slice(0, FEEDBACK_MAX),
    device: device.slice(0, 200),
  };
}

/** Whether Send can go: a new method needs words, a problem needs its kind. */
export function canSend(kind: FeedbackKind | null, body: string): boolean {
  if (!kind) return false;
  return kind !== 'different' || body.trim().length > 0;
}

/** Why it didn't send, in words. */
export function feedbackError(error: { code?: string } | null | undefined, sentToday: number | null): string {
  if (error?.code === '42501' && sentToday != null && sentToday >= FEEDBACK_DAILY_LIMIT) {
    return `You’ve sent ${FEEDBACK_DAILY_LIMIT} notes today, the most we take from one person in a day. Try again tomorrow, or email us instead.`;
  }
  return 'It didn’t send. Check your connection and try again, or email us instead.';
}

/** The email for "Email us instead": the note, where it came from, the app version and device. */
export function feedbackEmail(productName: string, kind: FeedbackKind, body: string, place: FeedbackPlace, device: string): { subject: string; body: string } {
  const label = kind === 'different' ? 'We do it differently' : (PROBLEM_KINDS.find((k) => k.id === kind)?.label ?? 'A problem');
  const text = [body.trim() || '(No details)', '', '---', sentWithLine(place), device].join('\n');
  return { subject: `${productName}: ${label}`, body: text };
}
