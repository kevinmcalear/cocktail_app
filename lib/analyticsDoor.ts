import { analyticsAvailable, analyticsOptedOut, track, type Door } from '@/lib/analytics';
import { deviceStore } from '@/lib/deviceStore';

export const ANALYTICS_DOOR_KEY = 'analytics_door_v1';

/** What this device did before signing in: fixed labels and a count, nothing of the person's. */
interface Held {
  door: Door | null;
  ranks: number;
}

const NOTHING: Held = { door: null, ranks: 0 };

async function read(): Promise<Held> {
  try {
    const saved = await deviceStore.getItem(ANALYTICS_DOOR_KEY);
    return saved ? { ...NOTHING, ...(JSON.parse(saved) as Partial<Held>) } : NOTHING;
  } catch {
    return NOTHING;
  }
}

// One at a time, so a link opened during a sign-in can't lose either write.
let last: Promise<unknown> = Promise.resolve();
function inTurn<T>(step: () => Promise<T>): Promise<T> {
  const next = last.then(step, step);
  last = next.catch(() => undefined);
  return next;
}

function hold(change: (held: Held) => Held): void {
  if (!analyticsAvailable() || analyticsOptedOut()) return;
  void inTurn(async () => {
    await deviceStore.setItem(ANALYTICS_DOOR_KEY, JSON.stringify(change(await read())));
  }).catch(() => undefined);
}

/** The first way in on this device wins. */
export function noteDoor(door: Door): void {
  hold((held) => (held.door ? held : { ...held, door }));
}

/** Rank it with no account: counted now, and as kept if they go on to sign in. */
export function noteRankedSignedOut(): void {
  track('ranked_signed_out', { held: false });
  hold((held) => ({ door: held.door ?? 'rank', ranks: held.ranks + 1 }));
}

/**
 * Someone signed in on this device, by code or email link (AnalyticsIdentity
 * sees both). Sends kept for ranks waiting here, then forgets what was held.
 */
export function noteSignIn(): void {
  if (!analyticsAvailable()) return;
  void inTurn(async () => {
    const held = await read();
    await deviceStore.removeItem(ANALYTICS_DOOR_KEY).catch(() => undefined);
    if (held.ranks > 0) track('kept', { ranks: held.ranks });
  }).catch(() => undefined);
}
