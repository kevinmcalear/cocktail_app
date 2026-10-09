// Launch analytics: a short, fixed list of product events. Everything goes
// through track(), so what we collect is readable in one place. Properties are
// only flags, counts and fixed labels: never names, emails, free text, ids of
// people or anything someone typed. PostHog itself loads lazily (Analytics.tsx)
// and only when EXPO_PUBLIC_POSTHOG_KEY is set; without it track() does nothing.
// People can turn it off in Settings (lib/analyticsChoice.ts saves that).

import type { BarClaimMethod } from '@/lib/claimVerification';

export type AnalyticsProps = Record<string, boolean | number | string | null>;

/** Every event we send, with the properties it may carry. */
export interface AnalyticsEvents {
  sign_up: undefined;
  age_check_passed: undefined;
  drink_ranked: { rerank: boolean; at_bar: boolean };
  drink_collected: { kind: 'drink' | 'release' };
  drink_made: { compared: 'better' | 'same' | 'worse' | 'none'; swaps: number };
  drink_created: { at_bar: boolean; on_menu: boolean };
  invite_sent: undefined;
  claim_started: { method: BarClaimMethod; approved: boolean };
  search_used: { surface: 'search' | 'discover' };
}

export type AnalyticsEvent = keyof AnalyticsEvents;

interface AnalyticsClient {
  capture(event: string, properties?: AnalyticsProps): void;
  optIn?(): unknown;
  optOut?(): unknown;
}

let client: AnalyticsClient | null = null;
// The person's choice: null until it's read from the device, so nothing is
// sent before we know it.
let optedOut: boolean | null = null;
const listeners = new Set<() => void>();
// Events from before PostHog finishes loading (a chunk on web), sent once it has.
const pending: { event: string; props?: AnalyticsProps }[] = [];
const MAX_PENDING = 50;

/** True when this build has analytics at all (a PostHog key, and a browser or device). */
export function analyticsAvailable(): boolean {
  return !!process.env.EXPO_PUBLIC_POSTHOG_KEY && typeof window !== 'undefined';
}

/** The opt-out choice, or null while it's still being read. */
export function analyticsOptedOut(): boolean | null {
  return optedOut;
}

/** For useSyncExternalStore: called when the choice changes. */
export function subscribeAnalytics(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Records the choice in memory and tells PostHog straight away. Opting out
 * drops anything still waiting to be sent.
 */
export function setAnalyticsOptOut(out: boolean): void {
  optedOut = out;
  if (out) pending.length = 0;
  try {
    void (out ? client?.optOut?.() : client?.optIn?.());
  } catch {
    // As in track().
  }
  for (const listener of listeners) listener();
}

/** Records one product event. Never throws: analytics must not break a flow. */
export function track<E extends AnalyticsEvent>(
  event: E,
  ...[props]: AnalyticsEvents[E] extends undefined ? [] : [AnalyticsEvents[E]]
): void {
  if (!analyticsAvailable() || optedOut) return;
  const properties = props as AnalyticsProps | undefined;
  try {
    if (client) client.capture(event, properties);
    else if (pending.length < MAX_PENDING) pending.push({ event, props: properties });
  } catch {
    // An analytics failure is not the user's problem.
  }
}

/** Called by Analytics.tsx once PostHog is ready, and with null when it unmounts. */
export function setAnalyticsClient(next: AnalyticsClient | null): void {
  client = next;
  if (!next) return;
  // PostHog keeps its own opt-out from an earlier session; ours wins.
  setAnalyticsOptOut(!!optedOut);
  if (optedOut) return;
  for (const { event, props } of pending.splice(0)) {
    try {
      next.capture(event, props);
    } catch {
      // As above.
    }
  }
}
