import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { logoEdgeFromUrl } from '../supabase/functions/_shared/logoEdge';
import { bucketPath, FILE_NAME, MANIFEST } from './maker-logos.mjs';

// The company logos manifest (scripts/maker-logos.mjs): one logo per page,
// each named so the app reads its edge, each citing the company's own pages.

const { logos } = JSON.parse(readFileSync(MANIFEST, 'utf8')) as {
  logos: { handle: string; file: string; source: string; page: string }[];
};
assert.ok(logos.length > 0);
assert.equal(new Set(logos.map((l) => l.handle)).size, logos.length, 'one logo per page');
for (const l of logos) {
  assert.equal(l.file.match(FILE_NAME)?.[1], l.handle, `${l.handle}: file is <handle>.e<hex>.png`);
  assert.equal(logoEdgeFromUrl(`https://x.supabase.co/storage/v1/object/public/avatars/${bucketPath('maker', l.file)}`)?.kind, 'solid', l.handle);
  assert.match(l.page, /^https:\/\//, `${l.handle}: page`);
  assert.match(l.source, /^(https:\/\/|inline SVG)/, `${l.handle}: source`);
}
assert.equal(bucketPath('bar', 'a.effffff.png'), 'venues/a.effffff.png');
assert.equal(bucketPath('maker', 'a.effffff.png'), 'makers/a.effffff.png');
