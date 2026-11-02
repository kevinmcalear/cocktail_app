import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { declaredEvents, eventBlock, eventsSentIn } from '../scripts/analytics-events.mjs';

// Every event lib/analytics.ts declares has a real caller, so a dashboard is
// never waiting on something nothing sends.
const skip = /\.(test|check)\.tsx?$|^lib\/analytics\.ts$/;

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) && !skip.test(path) ? [path] : [];
  });
}

const declaration = readFileSync('lib/analytics.ts', 'utf8');
const declared = declaredEvents(declaration);
assert.ok(declared.includes('sign_up'), 'expected to find the event list in lib/analytics.ts');

const sent = new Set(['app', 'components', 'ctx', 'hooks', 'lib'].flatMap(sources).flatMap((path) => eventsSentIn(readFileSync(path, 'utf8'))));
assert.deepEqual(declared.filter((event) => !sent.has(event)), [], 'declared events with no caller');

// The privacy rule at lib/analytics.ts's head: fixed labels, never free text.
assert.doesNotMatch(eventBlock(declaration), /:\s*string\b/, 'an event property may not be a bare string');

// The scanners themselves.
assert.deepEqual(declaredEvents('export interface AnalyticsEvents {\n  a_b: undefined;\n  // note\n  c: { d: boolean };\n}\n'), ['a_b', 'c']);
assert.deepEqual(eventsSentIn(`track('a_b'); track( 'c', { d: true }); untrack('x');`), ['a_b', 'c']);
