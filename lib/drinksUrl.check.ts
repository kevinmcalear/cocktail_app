import assert from 'node:assert/strict';

import { drinksBucketUrl } from '../supabase/functions/_shared/drinksUrl';

const project = 'https://abc.supabase.co';
const logo = 'https://abc.supabase.co/storage/v1/object/public/drinks/logos/a.png';

assert.equal(drinksBucketUrl(logo, project), logo);
assert.equal(drinksBucketUrl('https://evil.test/storage/v1/object/public/drinks/a.png', project), null);
assert.equal(drinksBucketUrl('https://abc.supabase.co/latest/meta-data', project), null);
assert.equal(drinksBucketUrl('http://169.254.169.254/latest/meta-data', project), null);
assert.equal(drinksBucketUrl('http://abc.supabase.co/storage/v1/object/public/drinks/a.png', project), null);
assert.equal(drinksBucketUrl('https://user:pass@abc.supabase.co/storage/v1/object/public/drinks/a.png', project), null);
assert.equal(
  drinksBucketUrl('https://abc.supabase.co/storage/v1/object/public/drinks/%2e%2e/secret', project),
  null,
);
assert.ok(
  drinksBucketUrl('http://127.0.0.1:54321/storage/v1/object/public/drinks/x.png', project)?.includes('127.0.0.1'),
);

console.log('drinksUrl ok');
