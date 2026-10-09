// Checks for lib/claimVerification.ts. Run: npm run test:unit
// The same cases run against the database in supabase/tests/bar-claims.test.mjs.
import assert from 'node:assert/strict';

import { claimPlace, claimProblem, emailCheck, isSharedHost, pageInstagram, siteHost, siteIsRoot, spacedCode } from './claimVerification';

// Hosts lose the scheme, www., port, path and case.
assert.equal(siteHost('https://www.PaleMoth.com/en?x=1'), 'palemoth.com');
assert.equal(siteHost('palemoth.com.au'), 'palemoth.com.au');
assert.equal(siteHost('http://palemoth.com:8080/'), 'palemoth.com');
assert.equal(siteHost('  '), null);
assert.equal(siteHost(null), null);

// A home page, not a page on a bigger site.
assert.equal(siteIsRoot('https://palemoth.com'), true);
assert.equal(siteIsRoot('https://palemoth.com/'), true);
assert.equal(siteIsRoot('https://palemoth.com/?utm=x'), true);
assert.equal(siteIsRoot('https://www.fourseasons.com/hongkong/dining/'), false);

// Shared hosts, and their subdomains.
assert.equal(isSharedHost('instagram.com'), true);
assert.equal(isSharedHost('palemoth.wixsite.com'), true);
assert.equal(isSharedHost('palemoth.com'), false);
assert.equal(isSharedHost('notwix.com'), false);

// Instagram from the column, then the website, then a social link.
assert.equal(pageInstagram({ instagram: 'PaleMoth', website: null }), 'palemoth');
assert.equal(pageInstagram({ instagram: null, website: 'https://www.instagram.com/pale.moth/' }), 'pale.moth');
assert.equal(pageInstagram({ instagram: null, website: 'https://palemoth.com', social_links: ['https://tiktok.com/@x', 'https://instagram.com/moth_bar'] }), 'moth_bar');
assert.equal(pageInstagram({ instagram: '', website: 'https://palemoth.com' }), null);

// Email: instant on the bar's own home page; a moderator for weaker matches; nothing for other domains.
assert.deepEqual(emailCheck('jo@palemoth.com', 'https://www.palemoth.com/', false), { ok: 'instant', domain: 'palemoth.com' });
assert.deepEqual(emailCheck('Jo@PaleMoth.com', 'palemoth.com', false), { ok: 'instant', domain: 'palemoth.com' });
assert.deepEqual(emailCheck('jo@fourseasons.com', 'https://www.fourseasons.com/hongkong/', false), { ok: 'review', domain: 'fourseasons.com', reason: 'page_on_larger_site' });
assert.deepEqual(emailCheck('jo@palemoth.com', 'https://palemoth.com', true), { ok: 'review', domain: 'palemoth.com', reason: 'closed_bar' });
assert.deepEqual(emailCheck('jo@instagram.com', 'https://instagram.com/', false), { ok: 'review', domain: 'instagram.com', reason: 'shared_site' });
assert.equal(emailCheck('jo@gmail.com', 'https://palemoth.com', false).ok, false);
assert.equal(emailCheck('jo@mail.palemoth.com', 'https://palemoth.com', false).ok, false);
assert.deepEqual(emailCheck('jo@gmail.com', 'https://www.instagram.com/palemoth/', false), { ok: false, why: 'shared-site', host: 'instagram.com', domain: 'gmail.com' });
assert.deepEqual(emailCheck('jo@palemoth.com', null, false), { ok: false, why: 'no-site', host: null, domain: 'palemoth.com' });
assert.deepEqual(emailCheck(null, 'https://palemoth.com', false), { ok: false, why: 'other-domain', host: 'palemoth.com', domain: null });

assert.equal(spacedCode('482913'), '482 913');

// The database's own words come through; anything else is a connection problem.
assert.equal(claimProblem({ code: 'P0001', message: 'This page has already been claimed.' }), 'This page has already been claimed.');
assert.equal(claimProblem({ code: '23505', message: 'duplicate key' }), 'You already have a claim waiting on this bar.');
assert.equal(claimProblem({ code: '23505', message: 'You already have a claim waiting on this maker.' }), 'You already have a claim waiting on this maker.');
assert.equal(claimPlace('maker'), 'company');
assert.equal(claimPlace('bar'), 'bar');
assert.match(claimProblem(null), /connection/);
