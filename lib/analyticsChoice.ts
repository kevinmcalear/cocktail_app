import { setAnalyticsOptOut } from '@/lib/analytics';
import { deviceStore } from '@/lib/deviceStore';

export const ANALYTICS_OPT_OUT_KEY = 'analytics_opt_out_v1';

/**
 * Reads the saved analytics choice once at startup. It belongs to the device,
 * not the account, so it outlives sign-out (and PostHog's reset(), which
 * forgets PostHog's own opt-out).
 */
export async function loadAnalyticsChoice(): Promise<void> {
  const saved = await deviceStore.getItem(ANALYTICS_OPT_OUT_KEY).catch(() => null);
  setAnalyticsOptOut(saved === 'out');
}

/** The Settings switch: applies at once, then saves for next launch. */
export async function saveAnalyticsChoice(out: boolean): Promise<void> {
  setAnalyticsOptOut(out);
  await (out ? deviceStore.setItem(ANALYTICS_OPT_OUT_KEY, 'out') : deviceStore.removeItem(ANALYTICS_OPT_OUT_KEY));
}
