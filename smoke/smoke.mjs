#!/usr/bin/env node
// After-deploy smoke check of the web app. Signed out and read-only: it never
// signs in, writes or calls paid services. On 22 Oct 2026 babyvom.it served
// pages with no JavaScript for about three hours and nobody noticed; this
// fails loudly instead.
//
//   npm run smoke                                  checks https://babyvom.it
//   npm run smoke -- --url <url> [--url <url>]     checks those instead
//   npm run smoke -- --expect-commit <sha>         first waits (up to 5 min) for babyvom.it to serve that commit
//   npm run smoke -- --out <dir>                   screenshots and console log (default smoke/results)
//
// Checks, at 390 px and 1440 px:
//   0. Which build babyvom.it serves (its /commit.txt, written by vercel.json's
//      buildCommand), and with --expect-commit, that it is the deployed one.
//   1. Each page's HTML has the app's scripts (/_expo/static/js/web/) and each loads with HTTP 200.
//   2. The app starts: signed out, / ends on the sign-in page with its heading and email field.
//   3. A public page shows data from Supabase: the Negroni's page shows its name.
//   4. No uncaught page errors, console errors or failed app scripts on those
//      pages. A few expected failures are warnings instead (WARN_RESPONSES).
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';

const { values } = parseArgs({
  options: {
    url: { type: 'string', multiple: true },
    out: { type: 'string', default: 'smoke/results' },
    'expect-commit': { type: 'string' },
  },
});
const PRODUCTION = 'https://babyvom.it';
const urls = [...new Set((values.url?.length ? values.url : [PRODUCTION]).filter(Boolean).map((u) => u.replace(/\/+$/, '')))];
const expectCommit = values['expect-commit']?.trim().toLowerCase() || null;
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
const NAVIGATION = 30_000;
const FETCH = 15_000;
const COMMIT_WAIT = 5 * 60_000;
const SCRIPT = /<script\b[^>]*\bsrc="([^"]*\/_expo\/static\/js\/web\/[^"]+)"/g;

// Failed responses that are warnings, not failures: they show in the summary
// but don't fail the run or open an issue. Keep this list short.
const WARN_RESPONSES = [
  // A missing picture shows a placeholder; the page still works.
  { why: 'missing picture', test: (status, type) => status === 404 && type === 'image' },
  // Signed out, Supabase refuses what only signed-in people may read, and the
  // app shows the signed-out view.
  { why: 'signed out', test: (status, type, url) => (status === 401 || status === 403) && /^https:\/\/[^/]+\.supabase\.co\//.test(url) },
];

const failures = [];
const warnings = [];
const notes = [];
const consoleLog = [];
const fail = (where, message) => {
  failures.push({ where, message });
  console.error(`FAIL ${where}: ${message}`);
};
const warn = (where, message) => {
  warnings.push({ where, message });
  console.log(`warn ${where}: ${message}`);
};
const note = (message) => {
  notes.push(message);
  console.log(`note ${message}`);
};
const pass = (where, message) => console.log(`ok   ${where}: ${message}`);
const short = (sha) => sha.slice(0, 8);

/** fetch that gives up after FETCH ms, so a hung server fails the check instead of the job's timeout. */
const get = (url, init = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(FETCH) });

/**
 * A Vercel deployment URL behind Vercel Authentication can't be checked
 * without a bypass secret. babyvom.it is never protected: a 401 there fails.
 */
async function isProtected(base) {
  if (base === PRODUCTION) return false;
  const res = await get(`${base}/`, { redirect: 'manual' }).catch(() => null);
  if (!res) return false;
  const to = res.headers.get('location') ?? '';
  return (res.status >= 300 && res.status < 400 && to.includes('vercel.com/sso-api')) || res.status === 401;
}

// --- 0. which build ---
/** The commit in `base`'s /commit.txt, or null when it doesn't say. */
async function servedCommit(base) {
  const res = await get(`${base}/commit.txt?t=${Date.now()}`).catch(() => null);
  if (!res?.ok || !(res.headers.get('content-type') ?? '').startsWith('text/plain')) return null;
  const text = (await res.text().catch(() => '')).trim().toLowerCase();
  return /^[0-9a-f]{7,40}$/.test(text) ? text : null;
}

async function checkBuild(base) {
  let commit = await servedCommit(base);
  if (expectCommit && commit && commit !== expectCommit) {
    console.log(`wait ${base} serves ${short(commit)}; waiting up to ${COMMIT_WAIT / 60_000} minutes for ${short(expectCommit)}`);
    const until = Date.now() + COMMIT_WAIT;
    while (commit !== expectCommit && Date.now() < until) {
      await sleep(15_000);
      commit = (await servedCommit(base)) ?? commit;
    }
    if (commit !== expectCommit) {
      fail(`${base} build`, `still serves commit ${short(commit)} ${COMMIT_WAIT / 60_000} minutes after the deploy of ${short(expectCommit)} succeeded, so that deploy did not reach it (or a newer one replaced it)`);
    }
  }
  if (commit) note(`${base} serves commit ${short(commit)}${expectCommit && commit === expectCommit ? ', the one just deployed' : ''}`);
  else note(`${base} does not say which commit it serves (no /commit.txt)${expectCommit ? `, so this may not be ${short(expectCommit)} yet` : ''}`);
}

// --- 1. scripts in the HTML, and they load ---
// One fetch per script, however many pages list it.
const scriptLoads = new Map();
const loadScript = (url) => {
  if (!scriptLoads.has(url)) {
    scriptLoads.set(
      url,
      get(url)
        .then(async (r) => (r.ok ? (await r.arrayBuffer(), null) : `returned ${r.status}`))
        .catch((e) => `failed: ${e.message}`),
    );
  }
  return scriptLoads.get(url);
};

async function checkHtml(base) {
  for (const path of HTML_PATHS) {
    const where = `${base}${path} HTML`;
    let html;
    try {
      const res = await get(`${base}${path}`);
      if (!res.ok) {
        fail(where, `the page returned ${res.status}, expected 200`);
        continue;
      }
      html = await res.text();
    } catch (e) {
      fail(where, `the page did not load: ${e.message}`);
      continue;
    }
    const srcs = [...new Set([...html.matchAll(SCRIPT)].map((m) => m[1]))];
    if (!srcs.length) {
      fail(where, 'no app script tags (`<script src="/_expo/static/js/web/...">`) in the HTML, so the page renders with no JavaScript (the 22 Oct 2026 failure)');
      continue;
    }
    if (path === '/') {
      const entry = srcs.map((s) => s.split('/').at(-1)).find((s) => s.startsWith('entry-'));
      if (entry) note(`${base} entry script: ${entry}`);
    }
    const results = await Promise.all(srcs.map((src) => loadScript(new URL(src, `${base}${path}`).href)));
    const bad = srcs.map((src, i) => results[i] && `${src} ${results[i]}`).filter(Boolean);
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

/** Listens for errors on `page`; the returned lists fill in as it runs. */
function watch(page, where, origin) {
  const errors = [];
  const warned = [];
  page.on('console', (m) => {
    consoleLog.push(`${where} [${m.type()}] ${m.text()}`);
    // Chrome logs every failed request as "Failed to load resource"; those are
    // judged from the response below, which knows its type and URL.
    if (m.type() !== 'error' || m.text().startsWith('Failed to load resource')) return;
    errors.push(`console error: ${m.text()}${m.location()?.url ? ` (${m.location().url})` : ''}`);
  });
  page.on('pageerror', (e) => {
    consoleLog.push(`${where} [pageerror] ${e.message}`);
    errors.push(`uncaught error: ${e.message}`);
  });
  page.on('response', (r) => {
    const status = r.status();
    if (status < 400) return;
    const type = r.request().resourceType();
    const line = `${status} ${type} ${r.url()}`;
    consoleLog.push(`${where} [response] ${line}`);
    const allowed = WARN_RESPONSES.find((w) => w.test(status, type, r.url()));
    if (allowed) warned.push(`${line} (${allowed.why})`);
    else if (type !== 'document') errors.push(`failed request: ${line}`);
  });
  page.on('requestfailed', (req) => {
    const reason = req.failure()?.errorText ?? 'failed';
    consoleLog.push(`${where} [requestfailed] ${req.resourceType()} ${req.url()} ${reason}`);
    // Leaving a page aborts its requests in flight; that's not a failure.
    if (reason.includes('ERR_ABORTED')) return;
    if (req.resourceType() === 'script' && req.url().startsWith(origin)) errors.push(`app script did not load: ${req.url()} (${reason})`);
  });
  return { errors, warned };
}

async function checkBrowser(browser, base) {
  const host = new URL(base).host.replace(/[^a-z0-9.-]/gi, '_');
  const origin = new URL(base).origin;
  for (const size of WIDTHS) {
    // A fresh context per width: signed out, nothing remembered.
    const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, serviceWorkers: 'block' });
    context.setDefaultTimeout(WAIT);
    context.setDefaultNavigationTimeout(NAVIGATION);
    for (const p of PAGES) {
      const where = `${base}${p.path} at ${size.width} px`;
      const page = await context.newPage();
      const { errors, warned } = watch(page, where, origin);
      let loaded = false;
      try {
        const res = await page.goto(`${base}${p.path}`, { waitUntil: 'load' });
        if (!res) fail(where, 'the page gave no response');
        else if (!res.ok()) fail(where, `the page returned ${res.status()}, so its checks were skipped`);
        else loaded = true;
      } catch (e) {
        fail(where, `could not load: ${e.message.split('\n')[0]}`);
      }
      if (loaded) {
        const problem = await p.check(page);
        // Let late requests settle so their errors are caught too.
        await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
        if (problem) fail(where, problem);
        else pass(where, p.ok);
        if (errors.length) {
          const more = errors.length > 3 ? ` (and ${errors.length - 3} more in console.log)` : '';
          fail(where, `${errors.length} error(s): ${errors.slice(0, 3).join(' | ')}${more}`);
        }
        if (warned.length) warn(where, `${warned.length} expected failure(s): ${warned.slice(0, 3).join(' | ')}${warned.length > 3 ? ' (more in console.log)' : ''}`);
      }
      await page.screenshot({ path: join(out, `${host}-${size.name}-${p.name}.png`), timeout: 10_000 }).catch(() => {});
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
      note(`${base} is behind Vercel Authentication, skipped (it needs a bypass secret)`);
      if (process.env.GITHUB_ACTIONS) console.log(`::notice::${base} is behind Vercel Authentication, skipped`);
      continue;
    }
    checked.push(base);
    if (base === PRODUCTION) await checkBuild(base);
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
  '',
  ...notes.map((n) => `- ${n}.`),
  ...(failures.length ? ['', '### Failures', '', ...failures.map((f) => `- **${f.where}**: ${f.message}`)] : []),
  ...(warnings.length ? ['', '### Warnings (expected, not failures)', '', ...warnings.map((w) => `- **${w.where}**: ${w.message}`)] : []),
  ...(failures.length ? ['', 'Screenshots and the console log are in the run\'s `smoke-results` artifact.'] : []),
  '',
].join('\n');
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
writeFileSync(join(out, 'summary.md'), summary);
console.log(`\n${failures.length ? `${failures.length} failure(s)` : 'All checks passed'}${warnings.length ? `, ${warnings.length} warning(s)` : ''} in ${seconds}s. Screenshots and console log: ${out}`);
process.exitCode = failures.length ? 1 : 0;
