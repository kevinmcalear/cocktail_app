// A stand-in for PostHog on this machine, so analytics can be checked on web and
// the iOS simulator without sending anything to production. It answers the SDK,
// prints each event as it lands, and on Ctrl-C lists what was never seen.
//
//   npm run analytics:capture                 listens on 8799
//   npm run analytics:capture -- --port 8800
//
// Then start the app with EXPO_PUBLIC_POSTHOG_KEY=phc_local and
// EXPO_PUBLIC_POSTHOG_HOST=http://localhost:8799 (docs/dev_flow.md#verify).
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { gunzipSync } from 'node:zlib';

import { declaredEvents } from './analytics-events.mjs';

const TAGS = ['app_surface', 'app_variant'];
const portAt = process.argv.indexOf('--port');
const port = portAt === -1 ? 8799 : Number(process.argv[portAt + 1]);
const declared = declaredEvents(readFileSync('lib/analytics.ts', 'utf8'));
const seen = new Map();
let total = 0;
let untagged = 0;

function eventsIn(buffer) {
  const text = (buffer[0] === 0x1f ? gunzipSync(buffer) : buffer).toString('utf8');
  const body = JSON.parse(text);
  return body.batch ?? (Array.isArray(body) ? body : [body]);
}

// PostHog keeps one event per uuid; the SDK resends a batch a reload cut off.
const uuids = new Set();

function note({ event, uuid, distinct_id: id, properties = {} }) {
  if (uuid && uuids.has(uuid)) return;
  if (uuid) uuids.add(uuid);
  total += 1;
  seen.set(event, (seen.get(event) ?? 0) + 1);
  const missing = TAGS.filter((tag) => properties[tag] == null);
  if (missing.length) untagged += 1;
  const own = Object.entries(properties).filter(([key]) => !key.startsWith('$') && !TAGS.includes(key) && key !== 'app_update');
  const shown = event === '$screen' ? properties.$screen_name : JSON.stringify(Object.fromEntries(own));
  const who = properties.$is_identified ? 'signed in' : 'anonymous';
  console.log(`${event}  ${shown}  [${properties.app_surface}/${properties.app_variant} ${who} ${String(id).slice(-4)}]${missing.length ? '  UNTAGGED' : ''}`);
}

const server = createServer((req, res) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] ?? '*');
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'POST' && /\/(batch|e|capture)\b/.test(req.url)) {
      try {
        eventsIn(Buffer.concat(chunks)).forEach(note);
      } catch (error) {
        console.error(`Could not read ${req.url}: ${error.message}`);
      }
    }
    res.end(JSON.stringify({ status: 1, featureFlags: {}, flags: {} }));
  });
});

server.listen(port, () => console.log(`Catching PostHog events on http://localhost:${port}. Ctrl-C for the report.`));

process.on('SIGINT', () => {
  console.log(`\n${total} events, ${untagged} untagged.`);
  console.log(`Seen: ${[...seen].map(([event, n]) => `${event} ${n}`).join(', ') || 'nothing'}`);
  console.log(`Declared but not seen: ${declared.filter((event) => !seen.has(event)).join(', ') || 'none'}`);
  process.exit(0);
});
