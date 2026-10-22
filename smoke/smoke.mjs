#!/usr/bin/env node
// After-deploy smoke check of the web app. Signed out and read-only: it never
// signs in, writes or calls paid services. On 22 Oct 2026 babyvom.it served
// pages with no JavaScript for about three hours and nobody noticed; this
// fails loudly instead.
//
//   npm run smoke                                  checks https://babyvom.it
//   npm run smoke -- --url <url> [--url <url>]     checks those instead
//   npm run smoke -- --out <dir>                   screenshots and console log (default smoke/results)
//
// Checks, at 390 px and 1440 px:
//   1. Each page's HTML has the app's scripts (/_expo/static/js/web/) and each loads with HTTP 200.
//   2. The app starts: signed out, / ends on the sign-in page with its heading and email field.
//   3. A public page shows data from Supabase: the Negroni's page shows its name.
//   4. No uncaught page errors and no console errors on those pages.
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';

const { values } = parseArgs({
  options: {
    url: { type: 'string', multiple: true },
    out: { type: 'string', default: 'smoke/results' },
  },
});
const urls = (values.url?.length ? values.url : ['https://babyvom.it']).filter(Boolean).map((u) => u.replace(/\/+$/, ''));
const out = resolve(values.out);
mkdirSync(out, { recursive: true });

// The Negroni is a classic seeded in production (/d/negroni resolves by its
// share slug); its name is the least likely in the catalog to change.
const DRINK = { path: '/d/negroni', name: 'Negroni' };
const HTML_PATHS = ['/', '/auth/login', DRINK.path];
const WIDTHS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
];
const WAIT = 20_000;
const SCRIPT = /<script\b[^>]*\bsrc="([^"]*\/_expo\/static\/js\/web\/[^"]+)"/g;

const failures = [];
const notes = [];
const consoleLog = [];
const fail = (where, message) => {
  failures.push({ where, message });
  console.error(`FAIL ${where}: ${message}`);
};
const pass = (where, message) => console.log(`ok   ${where}: ${message}`);

/** A Vercel deployment URL behind Vercel Authentication can't be checked without a bypass secret. */
async function isProtected(base) {
  const res = await fetch(`${base}/`, { redirect: 'manual' }).catch(() => null);
  if (!res) return false;
  const to = res.headers.get('location') ?? '';
  return (res.status >= 300 && res.status < 400 && to.includes('vercel.com/sso-api')) || res.status === 401;
}

// --- 1. scripts in the HTML, and they load ---
async function checkHtml(base) {
  for (const path of HTML_PATHS) {
    const where = `${base}${path} HTML`;
    const res = await fetch(`${base}${path}`).catch((e) => ({ ok: false, status: e.message }));
    if (!res.ok) {
      fail(where, `the page returned ${res.status}, expected 200`);
      continue;
    }
    const html = await res.text();
    const srcs = [...new Set([...html.matchAll(SCRIPT)].map((m) => m[1]))];
    if (!srcs.length) {
      fail(where, 'no app script tags (`<script src="/_expo/static/js/web/...">`) in the HTML, so the page renders with no JavaScript (the 22 Oct 2026 failure)');
      continue;
    }
    const bad = [];
    for (const src of srcs) {
      const r = await fetch(new URL(src, `${base}${path}`)).catch((e) => ({ ok: false, status: e.message }));
      if (!r.ok) bad.push(`${src} returned ${r.status}`);
      else await r.arrayBuffer();
    }
    if (bad.length) fail(where, `app scripts did not load: ${bad.join('; ')}`);
    else pass(where, `${srcs.length} app scripts, all 200`);
  }
}

// --- 2 to 4. in a browser ---
async function signIn(page) {
  try {
    await page.waitForURL(/\/auth\/login/, { timeout: WAIT });
  } catch {
    return `opening / did not end on /auth/login (still at ${page.url()} after ${WAIT / 1000}s), so the app's JavaScript did not start or the signed-out redirect broke`;
  }
  try {
    await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor({ timeout: WAIT });
    await page.getByRole('textbox', { name: 'Email' }).waitFor({ timeout: WAIT });
  } catch {
    return 'reached /auth/login but the "Sign in" heading and the Email field did not show';
  }
  return null;
}

async function drink(page) {
  const gate = page.getByRole('button', { name: 'Yes, I am' });
  const heading = page.getByRole('heading', { name: DRINK.name, exact: true, level: 1 });
  try {
    await gate.or(heading).first().waitFor({ timeout: WAIT });
    // The drinking-age question is asked once per device; the answer stays in the browser.
    if (await gate.isVisible()) await gate.click();
    await heading.waitFor({ timeout: WAIT });
  } catch {
    return `the public drink page did not show "${DRINK.name}" within ${WAIT / 1000}s, so the app did not start or could not read from Supabase`;
  }
  return null;
}

const PAGES = [
  { name: 'start', path: '/', check: signIn, ok: 'signed out, / ended on the sign-in page' },
  { name: 'drink', path: DRINK.path, check: drink, ok: `the public drink page shows "${DRINK.name}"` },
];

async function checkBrowser(browser, base) {
  const host = new URL(base).host.replace(/[^a-z0-9.-]/gi, '_');
  for (const size of WIDTHS) {
    // A fresh context per width: signed out, nothing remembered.
    const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, serviceWorkers: 'block' });
    for (const p of PAGES) {
      const where = `${base}${p.path} at ${size.width} px`;
      const page = await context.newPage();
      const errors = [];
      page.on('console', (m) => {
        const line = `[${m.type()}] ${m.text()}`;
        consoleLog.push(`${where} ${line}`);
        if (m.type() === 'error') errors.push(`console error: ${m.text()}${m.location()?.url ? ` (${m.location().url})` : ''}`);
      });
      page.on('pageerror', (e) => {
        consoleLog.push(`${where} [pageerror] ${e.message}`);
        errors.push(`uncaught error: ${e.message}`);
      });
      try {
        const res = await page.goto(`${base}${p.path}`, { waitUntil: 'load', timeout: 30_000 });
        if (!res?.ok()) fail(where, `the page returned ${res?.status()}`);
        const problem = await p.check(page);
        // Let late requests settle so their errors are caught too.
        await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
        if (problem) fail(where, problem);
        else pass(where, p.ok);
      } catch (e) {
        fail(where, `could not load: ${e.message.split('\n')[0]}`);
      }
      if (errors.length) {
        const more = errors.length > 3 ? ` (and ${errors.length - 3} more in console.log)` : '';
        fail(where, `${errors.length} console or page error(s): ${errors.slice(0, 3).join(' | ')}${more}`);
      }
      await page.screenshot({ path: join(out, `${host}-${size.name}-${p.name}.png`) }).catch(() => {});
      await page.close();
    }
    await context.close();
  }
}

const started = Date.now();
const checked = [];
const browser = await chromium.launch();
try {
  for (const base of urls) {
    if (await isProtected(base)) {
      const msg = `${base} is behind Vercel Authentication, skipped (it needs a bypass secret)`;
      notes.push(msg);
      console.log(`skip ${msg}`);
      if (process.env.GITHUB_ACTIONS) console.log(`::notice::${msg}`);
      continue;
    }
    checked.push(base);
    await checkHtml(base);
    await checkBrowser(browser, base);
  }
} finally {
  await browser.close();
}
if (!checked.length) fail('urls', `nothing was checked (${urls.join(', ')})`);

writeFileSync(join(out, 'console.log'), consoleLog.join('\n') + '\n');
const seconds = Math.round((Date.now() - started) / 1000);
const pages = [...new Set([...HTML_PATHS, ...PAGES.map((p) => p.path)])].join(', ');
const summary = [
  `## Smoke check ${failures.length ? 'failed' : 'passed'}`,
  '',
  `Checked ${checked.join(', ') || 'nothing'} (${pages}) at ${WIDTHS.map((w) => `${w.width} px`).join(' and ')} in ${seconds}s.`,
  ...notes.map((n) => `\n${n}.`),
  ...(failures.length ? ['', ...failures.map((f) => `- **${f.where}**: ${f.message}`), '', 'Screenshots and the console log are in the run\'s `smoke-results` artifact.'] : []),
  '',
].join('\n');
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
writeFileSync(join(out, 'summary.md'), summary);
console.log(`\n${failures.length ? `${failures.length} failure(s)` : 'All checks passed'} in ${seconds}s. Screenshots and console log: ${out}`);
process.exitCode = failures.length ? 1 : 0;
