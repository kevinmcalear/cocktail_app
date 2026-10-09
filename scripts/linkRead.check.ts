import assert from 'node:assert/strict';

import { checkLinkUrl, fetchLink, isPublicAddress, LinkError, MAX_LINK_BYTES, pageText, type LinkDeps } from '../supabase/functions/_shared/linkRead';

// read-anything's link reader must never reach a private address, and must
// hand the model something readable from a real recipe page.

// --- Links ---
for (const ok of ['https://punchdrink.com/recipes/negroni/', 'http://example.com/a?b=1', 'https://EXAMPLE.com:443/x']) assert.doesNotThrow(() => checkLinkUrl(ok), ok);
for (const bad of [
  'ftp://example.com/x',
  'file:///etc/passwd',
  'https://user:pw@example.com/',
  'https://example.com:8080/',
  'http://127.0.0.1/',
  'http://2130706433/',
  'http://0x7f.0.0.1/',
  'http://[::1]/',
  'http://localhost/',
  'http://metadata/',
  'http://db.internal/',
  'http://printer.local/',
  'javascript:alert(1)',
  'not a link',
]) assert.throws(() => checkLinkUrl(bad), LinkError, bad);

// --- Addresses ---
for (const ip of ['8.8.8.8', '104.16.132.229', '2606:4700::6810:84e5', '::ffff:8.8.8.8']) assert.equal(isPublicAddress(ip), true, ip);
for (const ip of ['10.0.0.1', '127.0.0.1', '169.254.169.254', '172.20.1.1', '192.168.1.1', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1', '64:ff9b::a00:1', '2001:db8::1', 'garbage']) {
  assert.equal(isPublicAddress(ip), false, ip);
}

// --- Page text: recipe data first, then title, description and visible text ---
const html = `<html><head><title>Negroni &amp; friends</title>
<meta property="og:description" content="Equal parts, stirred.">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Recipe","name":"Negroni","author":{"@type":"Person","name":"Jo"},"recipeIngredient":["1 oz gin","1 oz Campari","1 oz sweet vermouth"],"recipeInstructions":[{"@type":"HowToStep","text":"Stir with ice."}]}]}</script>
<style>.x{}</style><script>track()</script></head>
<body><p>Stir it&nbsp;cold.</p><div>Garnish: orange &frac12; wheel</div></body></html>`;
const text = pageText(html);
assert.ok(text.startsWith('Negroni\nBy Jo\n- 1 oz gin\n- 1 oz Campari\n- 1 oz sweet vermouth\nStir with ice.'), text);
assert.match(text, /Negroni & friends/);
assert.match(text, /Equal parts, stirred\./);
assert.match(text, /Stir it cold\.\nGarnish: orange ½ wheel/);
assert.doesNotMatch(text, /track\(\)|\.x\{\}/);
assert.ok(pageText('<p>x</p>'.repeat(20_000)).length <= 20_000);

// --- Fetching ---
const page = (body: string | Uint8Array<ArrayBuffer>, init: ResponseInit & { type?: string } = {}) =>
  new Response(body, { status: init.status ?? 200, headers: { 'content-type': init.type ?? 'text/html', ...(init.headers as Record<string, string>) } });
const deps = (routes: Record<string, () => Response>, dns: Record<string, string[]> = {}): LinkDeps & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    resolve: async (host) => dns[host] ?? ['93.184.216.34'],
    fetch: async (url, init) => {
      assert.equal(init.redirect, 'manual');
      calls.push(url);
      const route = routes[url];
      if (!route) throw new Error(`unexpected fetch ${url}`);
      return route();
    },
  };
};

void (async () => {
  // A page: its text.
  const ok = await fetchLink('https://example.com/negroni', deps({ 'https://example.com/negroni': () => page(html) }));
  assert.ok('text' in ok && ok.text.startsWith('Negroni'));

  // Redirects are followed, each hop checked; one to a private name stops before it's fetched.
  const hops = deps(
    { 'https://example.com/a': () => page('', { status: 301, headers: { location: '/b' } }), 'https://example.com/b': () => page('<p>Daiquiri</p>') },
  );
  assert.deepEqual(await fetchLink('https://example.com/a', hops), { text: 'Daiquiri' });
  assert.deepEqual(hops.calls, ['https://example.com/a', 'https://example.com/b']);
  const sneaky = deps({ 'https://example.com/a': () => page('', { status: 302, headers: { location: 'https://evil.example/x' } }) }, { 'evil.example': ['10.0.0.5'] });
  await assert.rejects(fetchLink('https://example.com/a', sneaky), LinkError);
  assert.deepEqual(sneaky.calls, ['https://example.com/a']);
  await assert.rejects(fetchLink('https://example.com/a', deps({ 'https://example.com/a': () => page('', { status: 302, headers: { location: 'http://169.254.169.254/latest' } }) })), LinkError);

  // A name that resolves anywhere private is never fetched, even alongside a public address.
  const split = deps({}, { 'mixed.example': ['93.184.216.34', '192.168.0.10'] });
  await assert.rejects(fetchLink('https://mixed.example/', split), LinkError);
  assert.deepEqual(split.calls, []);
  await assert.rejects(fetchLink('https://nowhere.example/', deps({}, { 'nowhere.example': [] })), /Couldn't find that site/);

  // Too many redirects, errors, too big, and types it can't read.
  const loop = deps({ 'https://example.com/l': () => page('', { status: 302, headers: { location: '/l' } }) });
  await assert.rejects(fetchLink('https://example.com/l', loop), /too many/);
  await assert.rejects(fetchLink('https://example.com/x', deps({ 'https://example.com/x': () => page('no', { status: 403 }) })), /\(403\)/);
  await assert.rejects(fetchLink('https://example.com/x', deps({ 'https://example.com/x': () => page('x', { headers: { 'content-length': String(MAX_LINK_BYTES + 1) } }) })), /too big/);
  await assert.rejects(fetchLink('https://example.com/x', deps({ 'https://example.com/x': () => page(new Uint8Array(MAX_LINK_BYTES + 10)) })), /too big/);
  await assert.rejects(fetchLink('https://example.com/z', deps({ 'https://example.com/z': () => page('PK', { type: 'application/zip' }) })), /can't be read/);

  // A photo or a PDF comes back as a file to read.
  const pdf = await fetchLink('https://example.com/specs.pdf', deps({ 'https://example.com/specs.pdf': () => page(new Uint8Array([37, 80, 68, 70]), { type: 'application/pdf' }) }));
  assert.ok('file' in pdf && pdf.file.mimeType === 'application/pdf' && pdf.file.bytes.length === 4);

  console.log('linkRead: ok');
})();
