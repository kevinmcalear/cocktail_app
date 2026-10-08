import assert from 'node:assert/strict';

import { setAnalyticsClient, track } from './analytics';

// Node has no window; track() only runs where PostHog could.
const g = globalThis as { window?: unknown };
const seen: [string, unknown][] = [];
const recorder = { capture: (e: string, p?: unknown) => void seen.push([e, p]) };

// Off without a key: nothing is captured or queued.
delete process.env.EXPO_PUBLIC_POSTHOG_KEY;
g.window = {};
track('sign_up');
setAnalyticsClient(recorder);
assert.deepEqual(seen, []);
setAnalyticsClient(null);

// On: events from before PostHog loads wait, then go in order with their properties.
process.env.EXPO_PUBLIC_POSTHOG_KEY = 'phc_test';
track('sign_up');
track('search_used', { surface: 'discover' });
assert.deepEqual(seen, []);
setAnalyticsClient(recorder);
track('drink_collected', { kind: 'drink' });
assert.deepEqual(seen, [
  ['sign_up', undefined],
  ['search_used', { surface: 'discover' }],
  ['drink_collected', { kind: 'drink' }],
]);

// A client that throws never breaks the caller.
setAnalyticsClient({
  capture: () => {
    throw new Error('offline');
  },
});
assert.doesNotThrow(() => track('invite_sent'));

// Static web rendering (no window) stays silent.
setAnalyticsClient(recorder);
seen.length = 0;
delete g.window;
track('sign_up');
assert.deepEqual(seen, []);

console.log('analytics checks passed');
