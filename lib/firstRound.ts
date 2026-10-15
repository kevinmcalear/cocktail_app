/**
 * The first round (decided 15 Oct 2026, Eddie's ask): after setup a venue
 * opens with only the Library, and each step a new person does opens a bit
 * more of the app, like learning a game one thing at a time. Drink Creators
 * and Admins make the Old Fashioned theirs, put it on a menu (Menus opens),
 * then see who pours one near them (Discover opens). Bartenders and
 * Employees open the menu (Menus) and then Discover. Every step can be
 * skipped, Show me everything ends it, and it only ever hides Menus and
 * Discover: never a tab the venue switched on.
 *
 * Progress lives in the person's auth user_metadata (`first_round`), beside
 * `onboarded`, so it follows them across devices. People who signed up
 * before this shipped have no `first_round` and never see it.
 * Checked by lib/firstRound.check.ts. Board: whole-app canvas, Onboarding,
 * "First round and Features".
 */

import type { VenueTab } from '@/lib/venueFeatures';

/** A Drink Creator or above makes drinks; everyone else is staff. */
export type RoundKind = 'make' | 'staff';

export type StepKey = 'house_spec' | 'menu' | 'discover' | 'open_menu';

/** A tab the round can hold back until its step comes up. */
export type RoundTab = Extract<VenueTab, 'menus' | 'discover'>;

export interface RoundStep {
  key: StepKey;
  title: string;
  detail: string;
  /** The tab this step opens, if any. */
  opens: RoundTab | null;
  /** The step's button. */
  action: string;
}

/** What's stored in user_metadata.first_round. */
export interface FirstRound {
  v: 1;
  started_at: string;
  /** Steps done or skipped. */
  done: StepKey[];
  /** Show me everything: the round is over, every tab back. */
  skipped_at?: string | null;
  /** The quiet "That's the round" card was dismissed. */
  done_seen?: boolean;
  /** Tabs whose "is open" card was seen or dismissed. */
  seen: RoundTab[];
}

/** Drink Creator is role level 35. */
export const MAKER_LEVEL = 35;

export const roundKind = (roleLevel: number): RoundKind => (roleLevel >= MAKER_LEVEL ? 'make' : 'staff');

const STEPS: Record<RoundKind, RoundStep[]> = {
  make: [
    { key: 'house_spec', title: 'Make the Old Fashioned yours', detail: 'Change a line, save your house spec', opens: null, action: 'Start with the Old Fashioned' },
    { key: 'menu', title: 'Put it on a menu', detail: 'Opens Menus', opens: 'menus', action: 'Open Menus' },
    { key: 'discover', title: 'See who pours one near you', detail: 'Opens Discover', opens: 'discover', action: 'Open Discover' },
  ],
  staff: [
    { key: 'open_menu', title: 'Open the menu', detail: 'Opens Menus', opens: 'menus', action: 'Open the menu' },
    { key: 'discover', title: 'See who pours your drinks near you', detail: 'Opens Discover', opens: 'discover', action: 'Open Discover' },
  ],
};

export const roundSteps = (kind: RoundKind): RoundStep[] => STEPS[kind];

/** What a tab's "is open" card says. */
export const OPENED_COPY: Record<RoundTab, { title: string; body: string; action: string }> = {
  menus: { title: 'Menus is open', body: 'What you’re pouring, and when. Put your Old Fashioned on one.', action: 'Open Menus' },
  discover: { title: 'Discover is open', body: 'Bars and drinks near you, and who pours what.', action: 'Open Discover' },
};

const STEP_KEYS: StepKey[] = ['house_spec', 'menu', 'discover', 'open_menu'];
const TABS: RoundTab[] = ['menus', 'discover'];

/** A new round, as setup finishes or Settings replays it. */
export function startRound(now: string): FirstRound {
  return { v: 1, started_at: now, done: [], seen: [] };
}

/** user_metadata.first_round, or null for anyone who never had one (everyone before this shipped). */
export function readRound(metadata: unknown): FirstRound | null {
  const raw = metadata && typeof metadata === 'object' ? (metadata as { first_round?: unknown }).first_round : null;
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<FirstRound>;
  if (r.v !== 1 || typeof r.started_at !== 'string') return null;
  return {
    v: 1,
    started_at: r.started_at,
    done: Array.isArray(r.done) ? r.done.filter((k): k is StepKey => STEP_KEYS.includes(k as StepKey)) : [],
    skipped_at: typeof r.skipped_at === 'string' ? r.skipped_at : null,
    done_seen: r.done_seen === true,
    seen: Array.isArray(r.seen) ? r.seen.filter((t): t is RoundTab => TABS.includes(t as RoundTab)) : [],
  };
}

export const markDone = (round: FirstRound, key: StepKey): FirstRound => (round.done.includes(key) ? round : { ...round, done: [...round.done, key] });
export const skipAll = (round: FirstRound, now: string): FirstRound => ({ ...round, skipped_at: now });
export const seeOpened = (round: FirstRound, tab: RoundTab): FirstRound => (round.seen.includes(tab) ? round : { ...round, seen: [...round.seen, tab] });
export const seeDone = (round: FirstRound): FirstRound => ({ ...round, done_seen: true });

export interface RoundView {
  /** Steps are showing and tabs are held back. */
  active: boolean;
  steps: (RoundStep & { done: boolean })[];
  doneCount: number;
  total: number;
  current: RoundStep | null;
  /** Tabs held back until their step comes up. */
  hidden: RoundTab[];
  /** A tab that just opened and hasn't had its card seen. */
  opened: RoundTab | null;
  /** Every step done (not skipped as a whole) and the quiet card not yet dismissed. */
  showDone: boolean;
}

const NONE: RoundView = { active: false, steps: [], doneCount: 0, total: 0, current: null, hidden: [], opened: null, showDone: false };

/**
 * Where a round stands. A step's tab opens when the step comes up (after the
 * one before it is done) or once it's done; the first step's tab opens when
 * it's done, so a new person starts with the Library alone.
 */
export function roundView(round: FirstRound | null, kind: RoundKind): RoundView {
  if (!round || round.skipped_at) return NONE;
  const steps = STEPS[kind].map((s) => ({ ...s, done: round.done.includes(s.key) }));
  const at = steps.findIndex((s) => !s.done);
  const doneCount = steps.filter((s) => s.done).length;
  if (at === -1) return { ...NONE, steps, doneCount, total: steps.length, showDone: !round.done_seen };
  const open = (i: number) => steps[i].done || (i === at && i > 0);
  const hidden = steps.flatMap((s, i) => (s.opens && !open(i) ? [s.opens] : []));
  const current = steps[at];
  const opened = current.opens && open(at) && !round.seen.includes(current.opens) ? current.opens : null;
  return { active: true, steps, doneCount, total: steps.length, current, hidden, opened, showDone: false };
}
