import assert from 'node:assert/strict';

import { redactEmails, scrubBreadcrumb, scrubEvent, stripQuery } from './monitoringScrub';

assert.equal(redactEmails('No user found for Sam.Bar+1@example.co.uk, sorry'), 'No user found for [email], sorry');
assert.equal(redactEmails('nothing here'), 'nothing here');

assert.equal(stripQuery('https://x.supabase.co/rest/v1/items?name=ilike.*gin*'), 'https://x.supabase.co/rest/v1/items');
assert.equal(stripQuery('/auth/callback#access_token=abc'), '/auth/callback');
assert.equal(stripQuery('/cocktail/42'), '/cocktail/42');

// Console crumbs go; request and navigation crumbs keep only the path.
assert.equal(scrubBreadcrumb({ category: 'console', message: 'draft: Rum, lime' }), null);
assert.deepEqual(scrubBreadcrumb({ category: 'fetch', data: { url: 'https://x.supabase.co/rest/v1/a?email=eq.a@b.co', method: 'GET' } }), {
  category: 'fetch',
  data: { url: 'https://x.supabase.co/rest/v1/a', method: 'GET' },
});
assert.deepEqual(scrubBreadcrumb({ category: 'navigation', data: { from: '/search?q=negroni', to: '/cocktail/1' } }), {
  category: 'navigation',
  data: { from: '/search', to: '/cocktail/1' },
});
assert.deepEqual(scrubBreadcrumb({ category: 'ui.click', message: 'sent to a@b.co' }), { category: 'ui.click', message: 'sent to [email]' });

// Events: emails out of messages, request down to the path, user down to the id.
const event = scrubEvent({
  message: 'Invite failed for a@b.co',
  exception: { values: [{ value: 'User a@b.co already exists' }, {}] },
  request: { url: 'https://babyvom.it/auth/callback?code=secret', cookies: 'sb=1', headers: { Authorization: 'x' } },
  user: { id: 'u1', email: 'a@b.co', ip_address: '1.2.3.4' },
});
assert.equal(event.message, 'Invite failed for [email]');
assert.equal(event.exception?.values?.[0].value, 'User [email] already exists');
assert.deepEqual(event.request, { url: 'https://babyvom.it/auth/callback' });
assert.deepEqual(event.user, { id: 'u1' });
assert.deepEqual(scrubEvent({ user: { email: 'a@b.co' } }).user, {});

console.log('monitoringScrub checks passed');
