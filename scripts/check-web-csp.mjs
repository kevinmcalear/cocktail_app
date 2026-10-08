// After `expo export -p web`: every inline <script> in dist/ must be allowed
// by a hash in vercel.json's Content-Security-Policy, or the browser blocks it
// (script-src 'self'). Run by `npm run build:web`. When Expo changes what it
// inlines, this prints the hash to put in vercel.json.
import { createHash } from 'node:crypto';
import { globSync, readFileSync } from 'node:fs';

const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
const csp = vercel.headers
  .flatMap((h) => h.headers)
  .find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
const scriptSrc = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src ')) ?? '';
const allowed = new Set(scriptSrc.match(/'sha256-[^']+'/g) ?? []);

const pages = globSync('dist/**/*.html');
if (!pages.length) throw new Error('No exported pages in dist/. Run expo export -p web first.');

const missing = new Map();
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  for (const [, body] of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
    const hash = `'sha256-${createHash('sha256').update(body).digest('base64')}'`;
    if (!allowed.has(hash)) missing.set(hash, (missing.get(hash) ?? []).concat(page));
  }
  if (/\son[a-z]+=/.test(html)) throw new Error(`${page} has an inline event handler, which script-src 'self' blocks.`);
}

if (missing.size) {
  for (const [hash, where] of missing) console.error(`Not in vercel.json's script-src: ${hash} (${where.length} pages, e.g. ${where[0]})`);
  process.exit(1);
}
console.log(`check-web-csp: ok (${pages.length} pages)`);
