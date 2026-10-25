import assert from 'node:assert/strict';

import middleware, { config } from '../middleware';

// The link-preview middleware (middleware.ts) answers bots for /d/<id or
// slug>, /m/<id or slug> and /p/<id or handle> (a bar), against a fake
// PostgREST: no network.

const DRINK = '0c2bead3-1ed9-4b1d-b79d-073f85eef5d2';
const BAR = '1df350fb-8ef7-4083-8c77-443cc400a0d4';
const calls: string[] = [];
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://db.test';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon';
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input);
  calls.push(url);
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  if (url.endsWith('/rpc/share_target')) {
    // share_target() answers only for a public drink: a private one's slug is no match.
    const { p_kind, p_slug } = JSON.parse(String(init?.body)) as { p_kind: string; p_slug: string };
    return json(p_kind === 'd' && p_slug === 'penicillin' ? DRINK : null);
  }
  if (url.includes('/published_items?') && url.includes(`id=eq.${DRINK}`)) {
    return json([{ id: DRINK, name: 'Penicillin', description: 'Scotch, lemon, honey-ginger.', origin: 'Modern Classic', origin_year: 2005, riff_of_id: null, bar_id: null, publish_mode: 'description', image_url: null, image_is_generated: null, creator_profile_id: null, origin_bar_profile_id: null }]);
  }
  // A bar's page: only kind=bar and public profiles answer, by id or handle.
  if (url.includes('/profiles?') && url.includes('kind=eq.bar') && (url.includes(`id=eq.${BAR}`) || url.includes('handle=eq.little.rye'))) {
    return json([{ id: BAR, handle: 'little.rye', display_name: 'Little Rye', bar_type: 'Cocktail bar', locality: 'Fitzroy', city: 'Melbourne', avatar_url: null, page_visibility: 'open' }]);
  }
  if (url.endsWith('/rpc/get_menu_editions')) {
    return json([{ name: 'Old menu', is_current: false, drinks: [] }, { name: 'Field Notes', is_current: true, drinks: [{ id: DRINK, name: 'Smoke & Fig Old Fashioned' }, { id: 'b', name: 'Rye Garden Highball' }, { id: 'c', name: 'Bolo Tie' }] }]);
  }
  if (url.endsWith('/rpc/get_venue_score')) return json([{ score: 9.14, rankers: 212 }]);
  return json([]);
}) as typeof fetch;

const BOT = 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)';
const PERSON = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ask = (path: string, ua = BOT) => middleware(new Request(`https://babyvom.it${path}`, { headers: { 'user-agent': ua } }));

assert.deepEqual(config.matcher, ['/m/:id', '/d/:id', '/p/:id']);

(async () => {

  // A slug link gets the drink's tags, and names the link it was shared as.
  const bySlug = await ask('/d/penicillin');
  assert.ok(bySlug);
  const html = await bySlug.text();
  assert.ok(html.includes('<meta property="og:title" content="Penicillin">'));
  assert.ok(html.includes('<meta property="og:url" content="https://babyvom.it/d/penicillin">'));
  assert.ok(html.includes(`https://babyvom.it/api/drink-og?id=${DRINK}&amp;v=`));

  // The id link still works, and asks no slug question.
  calls.length = 0;
  const byId = await ask(`/d/${DRINK}`);
  assert.ok(byId && (await byId.text()).includes(`<meta property="og:url" content="https://babyvom.it/d/${DRINK}">`));
  assert.ok(!calls.some((u) => u.includes('share_target')));

  // A slug that isn't public, or isn't a slug at all: the page's own tags.
  assert.equal(await ask('/d/secret-negroni'), undefined);
  assert.equal(await ask('/m/penicillin'), undefined);
  calls.length = 0;
  assert.equal(await ask("/d/x'%20or%201=1"), undefined);
  assert.deepEqual(calls, []);

  // People go straight to the page, without a single fetch.
  assert.equal(await ask('/d/penicillin', PERSON), undefined);
  assert.deepEqual(calls, []);

  // A bar page by handle: its name, where it is, what's on and its score.
  const bar = await ask('/p/little.rye');
  assert.ok(bar);
  const barHtml = await bar.text();
  assert.ok(barHtml.includes('<meta property="og:title" content="Little Rye">'));
  assert.ok(barHtml.includes('content="Cocktail bar in Fitzroy, Melbourne. On now: Field Notes. 9.1 bar score. On Cocktail."'));
  assert.ok(barHtml.includes('<meta property="og:url" content="https://babyvom.it/p/little.rye">'));
  assert.ok(barHtml.includes(`https://babyvom.it/api/bar-og?id=${BAR}&amp;v=`));
  // A person's page, or a handle nobody has: the page's own tags.
  assert.equal(await ask('/p/juniper.jo'), undefined);
  calls.length = 0;
  assert.equal(await ask('/p/%27or%201%3D1'), undefined);
  assert.deepEqual(calls, [], 'not a handle: no query');

  console.log('middleware.check: ok');
})();
