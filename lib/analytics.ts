// Launch analytics: a short, fixed list of product events. Everything goes
// through track(), so what we collect is readable in one place. Properties are
// only flags, counts and fixed labels: never names, emails, free text, ids of
// people or anything someone typed. PostHog itself loads lazily (Analytics.tsx)
// and only when EXPO_PUBLIC_POSTHOG_KEY is set; without it track() does nothing.

import type { BarClaimMethod } from '@/lib/claimVerification';

export type AnalyticsProps = Record<string, boolean | number | string | null>;

/** Every event we send, with the properties it may carry. */
export interface AnalyticsEvents {
  sign_up: undefined;
  age_check_passed: undefined;
  drink_ranked: { rerank: boolean; at_bar: boolean };
  drink_collected: { kind: 'drink' | 'release' };
  drink_created: { at_bar: boolean; on_menu: boolean };
  invite_sent: undefined;
  claim_started: { method: BarClaimMethod; approved: boolean };
  search_used: { surface: 'search' | 'discover' };
}

export type AnalyticsEvent = keyof AnalyticsEvents;

interface AnalyticsClient {
  capture(event: string, properties?: AnalyticsProps): void;
}

let client: AnalyticsClient | null = null;
// Events from before PostHog finishes loading (a chunk on web), sent once it has.
const pending: { event: string; props?: AnalyticsProps }[] = [];
const MAX_PENDING = 50;

function enabled(): boolean {
  return !!process.env.EXPO_PUBLIC_POSTHOG_KEY && typeof window !== 'undefined';
}

/** Records one product event. Never throws: analytics must not break a flow. */
export function track<E extends AnalyticsEvent>(
  event: E,
  ...[props]: AnalyticsEvents[E] extends undefined ? [] : [AnalyticsEvents[E]]
): void {
  if (!enabled()) return;
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
  for (const { event, props } of pending.splice(0)) {
    try {
      next.capture(event, props);
    } catch {
      // As above.
    }
  }
}
