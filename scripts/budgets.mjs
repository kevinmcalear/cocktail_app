// Quality budgets: Kevin's 17 numbers for how the app feels, enforced
// (quality/budgets.json). Most need a phone or field data; this checks the
// ones a static web export can show, after `expo export -p web` (build:web
// runs it, so CI does):
//   B12  webJs: every JavaScript file in the web export, raw bytes (not growing)
//   B13  first-load JS per page: the app's scripts in its HTML, brotli
//
//   node scripts/budgets.mjs                check against dist/
//   node scripts/budgets.mjs --update       lock gains in (it never loosens a number)
//   node scripts/budgets.mjs --dist <dir>   measure another export
//
// Like the design ratchet, it fails only when a number gets worse than the
// file says, by more than the budget's `noise` (env values and hashes differ a
// little between builds). A page over its `limit` is reported, not failed. To
// accept a worse number, edit `current` by hand and say why in the PR.
// A Vercel deploy (VERCEL set) only reports: it builds with production keys
// CI doesn't have, and the PR already passed CI.
import { globSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { brotliCompressSync, constants } from 'node:zlib';

import { pageFile, pageScripts } from './web-pages.mjs';

const FILE = 'quality/budgets.json';
const { values } = parseArgs({ options: { update: { type: 'boolean' }, dist: { type: 'string', default: 'dist' } } });
const dist = values.dist;
const gate = !process.env.VERCEL;

const brotli = new Map();
function brotliSize(file) {
  if (!brotli.has(file)) brotli.set(file, brotliCompressSync(readFileSync(file), { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length);
  return brotli.get(file);
}

/** First-load JS of a route ('/d/[id]', '/' for Tonight), brotli bytes; undefined when the export has no page for it. */
function firstLoad(route) {
  const file = pageFile(route === '/' ? 'index' : route.slice(1), dist);
  return file && pageScripts(file).reduce((sum, src) => sum + brotliSize(join(dist, src)), 0);
}

// What each budget measures here, by id: { key: bytes }.
const MEASURES = {
  B12: () => ({ webJs: globSync(join(dist, '_expo/static/js/web/*.js')).reduce((sum, f) => sum + statSync(f).size, 0) }),
  B13: (budget) => Object.fromEntries(Object.keys(budget.limit).filter((route) => !budget.pending?.[route]).map((route) => [route, firstLoad(route)])),
};

const size = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : `${(bytes / 1024).toFixed(1)} KB`);

if (!globSync(join(dist, '_expo/static/js/web/*.js')).length) {
  console.error(`check:budgets: no web export in ${dist}. Run \`npx expo export -p web\` (or npm run build:web) first.`);
  process.exit(1);
}

const data = JSON.parse(readFileSync(FILE, 'utf8'));
const worse = [];
let gains = 0;
for (const budget of data.budgets) {
  const measure = MEASURES[budget.id];
  if (!measure) continue;
  for (const [key, now] of Object.entries(measure(budget))) {
    const name = `${budget.id} ${key}`;
    if (now === undefined) {
      worse.push(`${name}: no page for it in ${dist}. Fix the route in ${FILE}.`);
      continue;
    }
    const before = budget.current[key] ?? null;
    const limit = budget.limit?.[key];
    const gap = limit === undefined ? '' : now > limit ? `, ${size(now - limit)} over its ${size(limit)} limit (${(now / limit).toFixed(1)}x)` : `, within its ${size(limit)} limit`;
    console.log(`${name}: ${size(now)}${before === null ? '' : ` (recorded ${size(before)})`}${gap}`);
    if (before === null) {
      if (values.update) budget.current[key] = now;
      else worse.push(`${name}: ${size(now)} has no recorded number. Run \`npm run check:budgets -- --update\` to record it.`);
    } else if (now > before + budget.noise) {
      worse.push(`${name}: ${size(before)} -> ${size(now)}, ${size(now - before)} worse`);
    } else if (now < before) {
      if (values.update) budget.current[key] = now;
      else if (now < before - budget.noise) gains++;
    }
  }
  for (const [key, why] of Object.entries(budget.pending ?? {})) console.log(`${budget.id} ${key}: skipped. ${why}`);
}

if (values.update) {
  writeFileSync(FILE, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`check:budgets: wrote ${FILE} (new numbers recorded, gains locked in).`);
}
if (gains) console.log(`${gains} number(s) got better. Run \`npm run check:budgets -- --update\` to lock that in.`);
if (worse.length) {
  console.error(`\nQuality budgets got worse (${FILE}):\n  ${worse.join('\n  ')}`);
  console.error('For a number that grew, find what grew (a new import in shared code, a heavy library on a public page) and trim it. If it is worth it, raise `current` by hand in the PR and say why.');
  if (gate) process.exit(1);
  console.error('Reported only: VERCEL is set, so this is a deploy, and CI is the gate.');
}
if (!worse.length) console.log('check:budgets: ok');
