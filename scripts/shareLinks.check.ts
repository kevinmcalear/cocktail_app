import assert from 'node:assert/strict';

import { LinkError, type LinkDeps } from '../supabase/functions/_shared/linkRead';
import { airtableDataPath, airtableText, readShareLink, shareLink } from '../supabase/functions/_shared/shareLinks';

// Bring in reads Google Doc, Google Sheet and Airtable share links (g388):
// public shares only, and every hop stays on that service's own hosts.

// --- Which links count, by exact host ---
const DOC = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789';
assert.deepEqual(shareLink(`https://docs.google.com/document/d/${DOC}/edit?usp=sharing`)?.url, `https://docs.google.com/document/d/${DOC}/export?format=txt`);
assert.equal(shareLink(`https://docs.google.com/spreadsheets/d/${DOC}/edit#gid=42`)?.url, `https://docs.google.com/spreadsheets/d/${DOC}/export?format=csv&gid=42`);
assert.equal(shareLink('https://airtable.com/shrAbCdEfGhIjKlMn')?.url, 'https://airtable.com/shrAbCdEfGhIjKlMn');
assert.equal(shareLink('https://airtable.com/appAbCdEfGhIjKlMn/shrAbCdEfGhIjKlMn/tblAbCdEfGhIjKlMn')?.kind, 'airtable');
for (const other of [
  `https://docs.google.com.evil.test/document/d/${DOC}/edit`,
  `https://evil.test/docs.google.com/document/d/${DOC}`,
  `http://docs.google.com/document/d/${DOC}/edit`,
  `https://user@docs.google.com/document/d/${DOC}/edit`,
  `https://docs.google.com:8443/document/d/${DOC}/edit`,
  'https://airtable.com.evil.test/shrAbCdEfGhIjKlMn',
  'https://notairtable.com/shrAbCdEfGhIjKlMn',
  'https://www.airtable.com/shrAbCdEfGhIjKlMn',
  'https://airtable.com/appAbCdEfGhIjKlMn',
  `https://docs.google.com/forms/d/${DOC}/viewform`,
  'not a link',
]) {
  assert.equal(shareLink(other), null, other);
}

// --- Fakes: public DNS, scripted responses, and a log of every hop ---
function fakes(routes: Record<string, () => Response>): LinkDeps & { hops: string[] } {
  const hops: string[] = [];
  return {
    hops,
    resolve: async () => ['142.250.1.1'],
    fetch: async (url: string) => {
      hops.push(url);
      const route = routes[url];
      if (!route) throw new Error(`unexpected fetch ${url}`);
      return route();
    },
  };
}
const redirect = (to: string) => new Response(null, { status: 307, headers: { location: to } });
const body = (text: string, type: string) => new Response(text, { status: 200, headers: { 'content-type': type } });

async function rejects(p: Promise<unknown>, pattern: RegExp) {
  await assert.rejects(p, (e: unknown) => e instanceof LinkError && pattern.test(e.message));
}

// --- Airtable: the view's own data request, read as JSON ---
const VIEW_HTML = `<script>window.initData = {"applicationId":"appAbCdEfGhIjKlMn"};
var prefetch = {"urlWithParams":"\\u002Fv0.3\\u002Fview\\u002FviwAbCdEfGhIjKlMn\\u002FreadSharedViewData?stringifiedObjectParams=%7B%22allowMsgpackOfResult%22%3Atrue%7D\\u0026requestId=req1\\u0026accessPolicy=%7B%7D"};</script>`;
const found = airtableDataPath(VIEW_HTML);
assert.equal(found?.appId, 'appAbCdEfGhIjKlMn');
assert.equal(found?.path, '/v0.3/view/viwAbCdEfGhIjKlMn/readSharedViewData?stringifiedObjectParams=%7B%22allowMsgpackOfResult%22%3Afalse%7D&requestId=req1&accessPolicy=%7B%7D');
assert.equal(airtableDataPath('<html>nothing here</html>'), null);

const VIEW_DATA = {
  msg: 'SUCCESS',
  data: {
    table: {
      columns: [
        { id: 'fldName', name: 'Name', type: 'text' },
        { id: 'fldSpec', name: 'Spec', type: 'multilineText' },
        { id: 'fldGlass', name: 'Glass', type: 'select', typeOptions: { choices: { selCoupe: { id: 'selCoupe', name: 'Coupe' } } } },
        { id: 'fldPreps', name: 'Preps', type: 'foreignKey' },
      ],
      rows: [
        { id: 'rec1', cellValuesByColumnId: { fldName: 'Orchard Fizz', fldSpec: '45 calvados\n15 pear', fldGlass: 'selCoupe', fldPreps: [{ foreignRowId: 'rec9', foreignRowDisplayName: 'Honey syrup' }] } },
        { id: 'rec2', cellValuesByColumnId: {} },
      ],
    },
  },
};
assert.equal(airtableText(VIEW_DATA), 'Name: Orchard Fizz\nSpec: 45 calvados\n15 pear\nGlass: Coupe\nPreps: Honey syrup');
assert.equal(airtableText({ msg: 'SUCCESS', data: {} }), '');

async function main() {
// A public doc exports as text, through Google's download host.
{
  const share = shareLink(`https://docs.google.com/document/d/${DOC}/edit`)!;
  const deps = fakes({
    [share.url]: () => redirect('https://doc-0s-8c-docs.googleusercontent.com/export/abc'),
    'https://doc-0s-8c-docs.googleusercontent.com/export/abc': () => body('Orchard Fizz\n45 ml calvados', 'text/plain; charset=utf-8'),
  });
  const content = await readShareLink(share, deps);
  assert.ok('text' in content && content.text.includes('45 ml calvados'));
}

// A private doc is sent to sign in: say how to share it, and never fetch the sign-in page.
{
  const share = shareLink(`https://docs.google.com/document/d/${DOC}/edit`)!;
  const deps = fakes({ [share.url]: () => redirect('https://accounts.google.com/ServiceLogin?continue=x') });
  await rejects(readShareLink(share, deps), /Anyone with the link/);
  assert.equal(deps.hops.length, 1);
}

// A redirect off Google's hosts is refused before it's fetched.
{
  const share = shareLink(`https://docs.google.com/spreadsheets/d/${DOC}/edit`)!;
  const deps = fakes({ [share.url]: () => redirect('https://evil.test/steal') });
  await rejects(readShareLink(share, deps), /can't be read/);
  assert.deepEqual(deps.hops, [share.url]);
}

// Only Google's export download host, not any googleusercontent.com page.
{
  const share = shareLink(`https://docs.google.com/document/d/${DOC}/edit`)!;
  const deps = fakes({ [share.url]: () => redirect('https://sites.googleusercontent.com/anything') });
  await rejects(readShareLink(share, deps), /can't be read/);
  assert.deepEqual(deps.hops, [share.url]);
}

// Every hop carries the share's time budget.
{
  const share = shareLink(`https://docs.google.com/document/d/${DOC}/edit`)!;
  let signal: AbortSignal | null | undefined;
  const deps: LinkDeps = { resolve: async () => ['142.250.1.1'], fetch: async (_url, init) => ((signal = init.signal), body('Orchard Fizz', 'text/plain')) };
  await readShareLink(share, deps);
  assert.ok(signal instanceof AbortSignal);
}

{
  const share = shareLink('https://airtable.com/shrAbCdEfGhIjKlMn')!;
  const dataUrl = `https://airtable.com${found!.path}`;
  const deps = fakes({ [share.url]: () => body(VIEW_HTML, 'text/html'), [dataUrl]: () => body(JSON.stringify(VIEW_DATA), 'application/json') });
  const content = await readShareLink(share, deps);
  assert.ok('text' in content && content.text.includes('Name: Orchard Fizz'));
  assert.deepEqual(deps.hops, [share.url, dataUrl]);
}
{
  const share = shareLink('https://airtable.com/shrAbCdEfGhIjKlMn')!;
  const deps = fakes({ [share.url]: () => body('<html>Sign in</html>', 'text/html') });
  await rejects(readShareLink(share, deps), /Download CSV/);
}

  console.log('shareLinks: ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
