// The first web journeys, on a production web export against the LOCAL
// Supabase stack (never production). Run: npm run test:e2e:web
//
// Before it, once per change:
//   1. The local stack is up (`supabase status` answers) with the demo venues:
//      docker exec -i supabase_db_cocktail_app psql -q -U postgres < supabase/seed_demo.sql
//   2. A web export built against it, in dist/ (or set E2E_DIST):
//      eval "$(supabase status -o env | grep -E '^(API_URL|ANON_KEY)=')"
//      EXPO_NO_DOTENV=1 EXPO_PUBLIC_SUPABASE_URL=$API_URL EXPO_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY npm run build:web
//
// It signs in the local demo user itself (scripts/dev-user.mjs: Admin at
// Little Rye) and serves the export with vercel.json's rewrites. Playwright
// comes from smoke/'s own install, so the app doesn't carry it.
// It also ratchets B17 (quality/budgets.json): the calls to Supabase a drink
// page makes, cold. Local only: CI has no stack to run this against.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { globSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

import { serve } from './server.mjs';

const { chromium } = createRequire(join(process.cwd(), 'smoke/package.json'))('playwright');

const DIST = process.env.E2E_DIST || 'dist';
const WAIT = 60_000;
// supabase/seed_demo.sql: the venue the demo user is Admin at, and one of its drinks.
const LITTLE_RYE = '00000000-0000-4000-a000-000000000001';
const HOUSE_MARTINI = { id: '00000000-0000-4000-c000-000000000001', name: 'House Martini' };
const TABS = [
  { name: 'Tonight', path: '/' },
  { name: 'Drinks', path: '/drinks' },
  { name: 'Discover', path: '/discover' },
  { name: 'You', path: '/you' },
];
const WIDTHS = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
const B17 = JSON.parse(readFileSync('quality/budgets.json', 'utf8')).budgets.find((b) => b.id === 'B17');

let stack;
let site;
let browser;
let session;

before(async () => {
  stack = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8' }));
  assert.match(stack.API_URL, /^http:\/\/(127\.0\.0\.1|localhost):/, 'local stack only');
  const common = globSync(join(DIST, '_expo/static/js/web/__common-*.js'));
  assert.ok(common.length, `no web export in ${DIST}: build one against the local stack (see the top of this file)`);
  assert.ok(
    common.some((f) => readFileSync(f, 'utf8').includes(stack.API_URL)),
    `${DIST} was not built against the local stack (${stack.API_URL}); rebuild it with EXPO_NO_DOTENV=1 and the local env (see the top of this file)`,
  );
  const user = spawnSync(process.execPath, ['scripts/dev-user.mjs'], { encoding: 'utf8' });
  assert.equal(user.status, 0, `scripts/dev-user.mjs failed. Are the demo venues loaded (supabase/seed_demo.sql)?\n${user.stderr}`);
  session = JSON.parse(readFileSync('.expo/dev-session.json', 'utf8'));
  site = await serve(DIST);
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  await site?.close();
});

/** A page that fails the journey on an uncaught error, and counts the calls it makes to Supabase. */
async function open({ width = 'phone', signedIn = false } = {}) {
  const context = await browser.newContext({ viewport: WIDTHS[width] });
  if (signedIn) {
    // The session dev-user.mjs wrote, at Little Rye in venue mode (store/useAppMode.ts).
    const mode = JSON.stringify({ state: { mode: 'venue', known: 'venue', venueId: LITTLE_RYE }, version: 0 });
    await context.addInitScript(([key, value, appMode]) => {
      localStorage.setItem(key, value);
      localStorage.setItem('app-mode', appMode);
    }, [session.storageKey, JSON.stringify(session.session), mode]);
  }
  const page = await context.newPage();
  page.setDefaultTimeout(WAIT);
  const errors = [];
  const calls = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => r.url().startsWith(stack.API_URL) && calls.push(`${r.method()} ${new URL(r.url()).pathname}`));
  return { page, errors, calls, close: () => context.close() };
}

/** Waits until no new call to Supabase for `quiet` ms, then returns how many there were. A page that keeps calling fails. */
async function settle(calls, quiet = 2000) {
  const end = Date.now() + 30_000;
  for (let seen = -1; seen !== calls.length; ) {
    assert.ok(Date.now() < end, `still calling Supabase after 30 s (${calls.length} calls): something polls`);
    seen = calls.length;
    await new Promise((done) => setTimeout(done, quiet));
  }
  return calls.length;
}

/** Fails when a page's calls to Supabase got worse than B17 records, by more than its noise. */
function checkCalls(key, count) {
  const before = B17.current?.[key] ?? null;
  console.log(`B17 ${key}: ${count} calls to Supabase${before === null ? '' : ` (recorded ${before})`}, target 3`);
  assert.ok(before !== null, `B17 has no number for "${key}": record ${count} in quality/budgets.json`);
  assert.ok(count <= before + B17.noise, `B17 ${key}: ${before} -> ${count} calls to Supabase. Find the new request, or raise \`current\` in quality/budgets.json and say why in the PR.`);
  if (count < before - B17.noise) console.log(`B17 ${key} got better: lower \`current\` in quality/budgets.json to ${count}.`);
}

/** A published drink to open signed out: the Negroni when the local stack has it, else any. */
async function publishedDrink() {
  const get = async (filter) => {
    const res = await fetch(`${stack.API_URL}/rest/v1/published_items?select=id,name&is_reference=eq.false${filter}&order=name&limit=1`, {
      headers: { apikey: stack.ANON_KEY },
    });
    assert.equal(res.status, 200, `reading published_items: ${res.status}`);
    return (await res.json())[0];
  };
  const drink = (await get('&name=eq.Negroni')) ?? (await get(''));
  assert.ok(drink, 'no published drink on the local stack to open');
  return drink;
}

test('a signed-out visitor opens a public drink page', async () => {
  const drink = await publishedDrink();
  const { page, errors, calls, close } = await open();
  await page.goto(`${site.url}/d/${drink.id}`);
  // The drinking-age question is asked once per browser.
  const gate = page.getByRole('button', { name: 'Yes, I am' });
  const heading = page.getByRole('heading', { name: drink.name, exact: true, level: 1 }).filter({ visible: true });
  await gate.or(heading).first().waitFor();
  if (await gate.isVisible()) await gate.click();
  await heading.first().waitFor();
  checkCalls('public drink page, cold', await settle(calls));
  assert.deepEqual(errors, []);
  await close();
});

for (const width of Object.keys(WIDTHS)) {
  test(`a venue Admin switches the four tabs, opens a drink from Drinks and comes back (${width})`, async () => {
    const { page, errors, close } = await open({ width, signedIn: true });
    // Phone width: the tab bar's tabs, aria-selected. Desktop: the sidebar's links, aria-current.
    const tab = (name) =>
      width === 'phone' ? page.getByRole('tab', { name, exact: true }) : page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name, exact: true });
    const isCurrent = (name) =>
      width === 'phone' ? tab(name).and(page.locator('[aria-selected="true"]')) : tab(name).and(page.locator('[aria-current="page"]'));

    await page.goto(`${site.url}/`);
    for (const t of TABS) await tab(t.name).waitFor();
    await isCurrent('Tonight').waitFor();
    for (const t of [...TABS.slice(1), TABS[0]]) {
      await tab(t.name).click();
      await page.waitForURL(`${site.url}${t.path}`);
      await isCurrent(t.name).waitFor();
    }

    await tab('Drinks').click();
    await page.waitForURL(`${site.url}/drinks`);
    const tile = page.getByLabel(new RegExp(`^${HOUSE_MARTINI.name}, .*open$`)).filter({ visible: true }).first();
    await tile.click();
    await page.waitForURL(`${site.url}/cocktail/${HOUSE_MARTINI.id}`);
    await page.getByRole('heading', { name: HOUSE_MARTINI.name, exact: true, level: 1 }).filter({ visible: true }).first().waitFor();
    // The phone's drink page has its own Back; the desktop's has none (the sidebar is there), so the browser's.
    if (width === 'phone') await page.getByRole('button', { name: 'Back', exact: true }).filter({ visible: true }).first().click();
    else await page.goBack();
    await page.waitForURL(`${site.url}/drinks`);
    await isCurrent('Drinks').waitFor();
    await tile.waitFor();
    assert.deepEqual(errors, []);
    await close();
  });
}

test('a venue Admin opens a drink page cold', async () => {
  const { page, errors, calls, close } = await open({ signedIn: true });
  await page.goto(`${site.url}/cocktail/${HOUSE_MARTINI.id}`);
  await page.getByRole('heading', { name: HOUSE_MARTINI.name, exact: true, level: 1 }).filter({ visible: true }).first().waitFor();
  checkCalls('staff drink page, cold', await settle(calls));
  assert.deepEqual(errors, []);
  await close();
});
