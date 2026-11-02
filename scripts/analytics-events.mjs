// Reads the event list out of lib/analytics.ts, for lib/analyticsCallers.check.ts
// and scripts/analytics-capture.mjs.

/** The body of the AnalyticsEvents interface. */
export function eventBlock(source) {
  return /export interface AnalyticsEvents \{\n([\s\S]*?)\n\}/.exec(source)?.[1] ?? '';
}

/** The event names AnalyticsEvents declares, in order. */
export function declaredEvents(source) {
  return [...eventBlock(source).matchAll(/^ {2}([a-z_]+):/gm)].map((match) => match[1]);
}

/** The event names a file passes to track(). */
export function eventsSentIn(source) {
  return [...source.matchAll(/\btrack\(\s*'([a-z_]+)'/g)].map((match) => match[1]);
}
