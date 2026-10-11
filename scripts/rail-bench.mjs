// RAIL numbers for a production web export, on a mid-range phone over slow 4G
// (4x CPU, 150 ms, 1.6 Mbps down). For each path: a cold load (empty cache),
// a repeat load (same browser, after the persisted query cache saved), long
// tasks over 50 ms, scroll frames, and one tap's event timing. Local only;
// see docs/dev_flow.md#verify.
//
//   npm i --no-save playwright-core && npx playwright-core install chromium-headless-shell
//   node scripts/dev-user.mjs     # a local session in .expo/dev-session.json
//   node scripts/rail-bench.mjs dist "/=House Martini" "/library=Tram Sour"
//
// Each argument is a path and text that is on screen once it's useful. WIDTH
// (default 390) sets the viewport; PORT (8197) where `dist` is served; CHROME a
// Chromium already on disk instead of Playwright's download.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { brotliCompressSync, constants } from 'node:zlib';

// Not a dependency: installed by hand, only to measure.
// eslint-disable-next-line import/no-unresolved
const { chromium } = await import('playwright-core').catch(() => {
  console.error('Needs playwright-core: npm i --no-save playwright-core');
  process.exit(1);
});

const [dist, ...targets] = process.argv.slice(2);
const PORT = Number(process.env.PORT ?? 8197);
const WIDTH = Number(process.env.WIDTH ?? 390);
const BASE = `http://127.0.0.1:${PORT}`;
const session = existsSync('.expo/dev-session.json') ? JSON.parse(readFileSync('.expo/dev-session.json', 'utf8')) : null;

// --- Serve dist like Vercel: clean URLs, vercel.json rewrites, immutable hashed assets, brotli ---
const rewrites = JSON.parse(readFileSync('vercel.json', 'utf8')).rewrites.map((r) => ({
  re: new RegExp(`^${r.source.replace(/:(\w+)/g, '[^/]+')}$`),
  to: r.destination,
}));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.png': 'image/png', '.svg': 'image/svg+xml' };
const compressed = new Map(); // once per file, as a CDN would
const server = createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, BASE).pathname);
  const path = rewrites.find((r) => r.re.test(url))?.to ?? url;
  const file = [path, `${path}.html`, join(path, 'index.html')].map((p) => join(dist, p)).find((p) => existsSync(p) && statSync(p).isFile()) ?? join(dist, 'index.html');
  const type = types[extname(file)] ?? 'application/octet-stream';
  let body = readFileSync(file);
  const headers = { 'Content-Type': type, 'Cache-Control': /^\/(_expo\/static|assets)\//.test(url) ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate' };
  if (/text|javascript|json|svg/.test(type)) {
    if (!compressed.has(file)) compressed.set(file, brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }));
    body = compressed.get(file);
    headers['Content-Encoding'] = 'br';
  }
  res.writeHead(200, headers).end(body);
});
await new Promise((ok) => server.listen(PORT, ok));

// --- Measure ---
const observe = () => {
  window.__lt = [];
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(e.duration))).observe({ type: 'longtask', buffered: true });
  window.__ev = [];
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__ev.push(e.duration))).observe({ type: 'event', durationThreshold: 16, buffered: true });
};
const useful = (text) => !!document.body && document.body.innerText.includes(text) && ![...document.querySelectorAll('[role=progressbar],[aria-label^="Loading"]')].some((n) => n.offsetParent);

async function load(ctx, path, text) {
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(observe);
  const start = Date.now();
  await page.goto(BASE + path, { waitUntil: 'commit' });
  const content = await page.waitForFunction(useful, text, { timeout: 45_000, polling: 50 }).then(() => Date.now() - start, () => 'timeout');
  await page.waitForTimeout(1500);
  const lt = await page.evaluate(() => window.__lt);
  return { page, content, tbt: Math.round(lt.reduce((s, d) => s + Math.max(0, d - 50), 0)), longest: Math.round(Math.max(0, ...lt)) };
}

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME }); // CHROME: an already-installed Chromium
const rows = [];
for (const target of targets) {
  const [path, text] = target.split('=');
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 844 } });
  if (session) await ctx.addInitScript((s) => localStorage.getItem(s.storageKey) || localStorage.setItem(s.storageKey, JSON.stringify(s.session)), session);
  const cold = await load(ctx, path, text);
  await cold.page.waitForTimeout(6000); // the persister saves at most every 5 s
  await cold.page.close();
  const warm = await load(ctx, path, text);
  // Scroll for 2 s and count frames over 33 ms, then tap the fourth control.
  await warm.page.evaluate(() => { window.__f = []; let last = performance.now(); const tick = (t) => { window.__f.push(t - last); last = t; if (window.__f.length < 300) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  await warm.page.mouse.move(WIDTH / 2, 500);
  for (let i = 0; i < 20; i++) { await warm.page.mouse.wheel(0, 250); await warm.page.waitForTimeout(100); }
  const janky = await warm.page.evaluate(() => window.__f.slice(2).filter((d) => d > 33).length);
  const seen = await warm.page.evaluate(() => window.__ev.length);
  await warm.page.locator('[role=link], [role=button]').filter({ visible: true }).nth(3).click({ timeout: 3000 }).catch(() => {});
  await warm.page.waitForTimeout(1500);
  const tap = await warm.page.evaluate((n) => Math.round(Math.max(0, ...window.__ev.slice(n))), seen);
  rows.push({ path, coldMs: cold.content, coldTBT: cold.tbt, repeatMs: warm.content, repeatTBT: warm.tbt, longestTask: Math.max(cold.longest, warm.longest), jankyFrames: janky, tapMs: tap || '<16' });
  await ctx.close();
}
console.table(rows);
await browser.close();
server.close();
