/**
 * The first round (decided 15 Oct 2026, Eddie's ask): after setup a venue
 * opens with only the Library, and each step a new person does opens a bit
 * more of the app, like learning a game one thing at a time. Drink Creators
 * and Admins add their first cocktail (from the Old Fashioned, a Margarita,
 * an Espresso Martini or from scratch, Eddie E30), put it on a menu (Menus opens),
 * then see who pours one near them (Discover opens). Every step can be
 * skipped, Show me everything ends it, and it only ever hides Menus and
 * Discover: never a tab the venue switched on.
 *
 * Bartenders and Employees get "Your first round" (board Kept-onboard, 1 Nov
 * 2026): read tonight's menu one drink at a time, learn the house-made, log a
 * batch on their first shift. It holds nothing back.
 *
 * Progress lives in the person's auth user_metadata (`first_round`), beside
 * `onboarded`, so it follows them across devices. People who signed up
 * before this shipped have no `first_round` and never see it.
 * Checked by lib/firstRound.check.ts.
 */

/** A Drink Creator or above makes drinks; everyone else is staff. */
export type RoundKind = 'make' | 'staff';

export type StepKey = 'house_spec' | 'menu' | 'discover' | 'read_menu' | 'house_made' | 'log_batch';

/** A place the round holds back until its step comes up (Menus in the venue menu and sidebar; the four tabs never change). */
export type RoundTab = 'menus' | 'discover';

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
  /** The drink saved in the first step: the menu step looks for it on a menu. */
  drink_id?: string | null;
  /** Staff: the drinks and house-made they've read, one at a time. */
  read?: string[];
}

/** Drink Creator is role level 35. */
export const MAKER_LEVEL = 35;

export const roundKind = (roleLevel: number): RoundKind => (roleLevel >= MAKER_LEVEL ? 'make' : 'staff');

const STEPS: Record<RoundKind, RoundStep[]> = {
  make: [
    // Its choices are FIRST_COCKTAILS, as buttons under the step (E30 B): no button of its own.
    { key: 'house_spec', title: 'Add your first cocktail', detail: 'Start from a classic, or from scratch', opens: null, action: 'Add your first cocktail' },
    { key: 'menu', title: 'Put it on a menu', detail: 'Opens Menus', opens: 'menus', action: 'Open Menus' },
    { key: 'discover', title: 'See who pours one near you', detail: 'Opens Discover', opens: 'discover', action: 'Open Discover' },
  ],
  // The lines under them come from the bar (the menu, its house-made, who you batch with): StaffRoundScreen.
  staff: [
    { key: 'read_menu', title: 'Read tonight’s menu', detail: 'One drink at a time', opens: null, action: 'Read tonight’s menu' },
    { key: 'house_made', title: 'Learn the house-made', detail: 'What the bar makes itself', opens: null, action: 'Learn the house-made' },
    { key: 'log_batch', title: 'Log a batch', detail: 'At the bar, on your first shift', opens: null, action: 'Log a batch' },
  ],
};

export const roundSteps = (kind: RoundKind): RoundStep[] => STEPS[kind];

/** The classics the first cocktail can start from, by their catalog names; From scratch comes after them. */
export const FIRST_COCKTAILS = ['Old Fashioned', 'Margarita', 'Espresso Martini'] as const;

/** What a tab's "is open" card says. */
export const OPENED_COPY: Record<RoundTab, { title: string; body: string; action: string }> = {
  menus: { title: 'Menus is open', body: 'What you’re pouring, and when. Put your first cocktail on one.', action: 'Open Menus' },
  discover: { title: 'Discover is open', body: 'Bars and drinks near you, and who pours what.', action: 'Open Discover' },
};

const STEP_KEYS: StepKey[] = ['house_spec', 'menu', 'discover', 'read_menu', 'house_made', 'log_batch'];
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
    // Someone who began the old staff round (Open the menu) is past their first round: it ends quietly.
    skipped_at: typeof r.skipped_at === 'string' ? r.skipped_at : (r.done as string[] | undefined)?.includes?.('open_menu') ? r.started_at : null,
    done_seen: r.done_seen === true,
    seen: Array.isArray(r.seen) ? r.seen.filter((t): t is RoundTab => TABS.includes(t as RoundTab)) : [],
    drink_id: typeof r.drink_id === 'string' ? r.drink_id : null,
    ...(Array.isArray(r.read) ? { read: r.read.filter((id): id is string => typeof id === 'string') } : {}),
  };
}

export const markDone = (round: FirstRound, key: StepKey, drinkId?: string): FirstRound =>
  round.done.includes(key) ? round : { ...round, done: [...round.done, key], ...(drinkId ? { drink_id: drinkId } : {}) };

/**
 * Whether the menu step is done: the drink from the first step is on one
 * of the venue's menus, or, when that step was skipped, any menu has a drink.
 */
export function onAMenu(round: FirstRound | null, menus: { kind: string; itemIds: string[] }[]): boolean {
  const real = menus.filter((m) => m.kind === 'menu');
  return round?.drink_id ? real.some((m) => m.itemIds.includes(round.drink_id as string)) : real.some((m) => m.itemIds.length > 0);
}
export const skipAll = (round: FirstRound, now: string): FirstRound => ({ ...round, skipped_at: now });
export const seeOpened = (round: FirstRound, tab: RoundTab): FirstRound => (round.seen.includes(tab) ? round : { ...round, seen: [...round.seen, tab] });
export const seeDone = (round: FirstRound): FirstRound => ({ ...round, done_seen: true });

export interface RoundView {
  /** The stored round, for checks that need more than the view (onAMenu). */
  round: FirstRound | null;
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

const NONE: RoundView = { round: null, active: false, steps: [], doneCount: 0, total: 0, current: null, hidden: [], opened: null, showDone: false };

/**
 * Where a round stands. A step's tab opens when the step comes up (after the
 * one before it is done) or once it's done; the first step's tab opens when
 * it's done, so a new person starts with the Library alone.
 */
export function roundView(round: FirstRound | null, kind: RoundKind): RoundView {
  if (!round || round.skipped_at) return { ...NONE, round };
  const steps = STEPS[kind].map((s) => ({ ...s, done: round.done.includes(s.key) }));
  const at = steps.findIndex((s) => !s.done);
  const doneCount = steps.filter((s) => s.done).length;
  if (at === -1) return { ...NONE, round, steps, doneCount, total: steps.length, showDone: !round.done_seen };
  const open = (i: number) => steps[i].done || (i === at && i > 0);
  const hidden = steps.flatMap((s, i) => (s.opens && !open(i) ? [s.opens] : []));
  const current = steps[at];
  const opened = current.opens && open(at) && !round.seen.includes(current.opens) ? current.opens : null;
  return { round, active: true, steps, doneCount, total: steps.length, current, hidden, opened, showDone: false };
}

/**
 * Read one drink or house-made. With `menu` (tonight's drinks, in order), the
 * menu's step is done once every one of them is read; with `houseMade`, that
 * step is done once all of those are.
 */
export function markRead(round: FirstRound, id: string, { menu, houseMade }: { menu?: readonly string[]; houseMade?: readonly string[] } = {}): FirstRound {
  const read = round.read ?? [];
  let next = read.includes(id) ? round : { ...round, read: [...read, id] };
  const all = (ids?: readonly string[]) => !!ids?.length && ids.every((m) => next.read?.includes(m));
  if (all(menu)) next = markDone(next, 'read_menu');
  if (all(houseMade)) next = markDone(next, 'house_made');
  return next;
}
