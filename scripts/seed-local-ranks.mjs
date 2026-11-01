// Test ranks for LOCAL score checks (lane H5): enough rankers that the real
// score states show, from below the floor to a city list. Never production.
//
//   node scripts/seed-local-ranks.mjs            add (or rebuild) the demo data
//   node scripts/seed-local-ranks.mjs --remove   take it all out again
//
// Adds six "Demo Rank" bars in New York, each pouring a Negroni (five in
// 10014, one in 10012), 26 rankers (age confirmed, none on staff) and their
// ranks: had on days across the last 240 days (so some count half), with
// reasons and room words. The first bar's Negroni changed its spec 12 days ago
// (version 2), so it shows a new score with the old one linked and six
// months of history; its Penicillin
// has 12 rankers (below the floor) and its Smoke Signal 14, so the bar's
// drinks together pass 50 ranks. It has a Winter
// menu from 20 days ago. demo@example.test (scripts/dev-user.mjs) is its Admin
// and credited with its Negroni and Penicillin and the second bar's Negroni. 24 classics get flavour
// profiles so the want deck has cards. Refuses anything but a local stack.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8' }));
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(status.API_URL) || !/@(127\.0\.0\.1|localhost):/.test(status.DB_URL)) {
  console.error(`Refusing to run against ${status.API_URL}: local stack only.`);
  process.exit(1);
}

const TAG = 'Demo Rank';
const EMAIL = (n) => `demo-ranker-${n}@seed.local`;
const RANKERS = 26;
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const db = new pg.Client({ connectionString: status.DB_URL });
await db.connect();

async function demoUsers() {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.filter((u) => /^demo-ranker-\d+@seed\.local$/.test(u.email ?? ''));
}

async function remove() {
  await db.query("DELETE FROM public.user_bars WHERE bar_id IN (SELECT id FROM public.bars WHERE name LIKE $1)", [`${TAG}%`]);
  await db.query('DELETE FROM public.items WHERE bar_id IN (SELECT id FROM public.bars WHERE name LIKE $1)', [`${TAG}%`]);
  await db.query("DELETE FROM public.profiles WHERE kind = 'bar' AND display_name LIKE $1", [`${TAG}%`]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [`${TAG}%`]);
  await db.query("DELETE FROM public.profiles WHERE kind = 'person' AND handle = 'demolocalranks'");
  await db.query("DELETE FROM public.item_flavors WHERE spec_fingerprint = 'seed-local'");
  for (const u of await demoUsers()) await admin.auth.admin.deleteUser(u.id);
  await db.query('SELECT private.refresh_rankings()');
}

const pick = (list, n) => list[n % list.length];
const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);

async function add() {
  await remove();
  const { rows: classics } = await db.query("SELECT id, name FROM public.items WHERE is_catalog AND item_type = 'cocktail' AND name IN ('Negroni', 'Penicillin')");
  // Flavour profiles for some classics, so the want deck has cards and each a match (the local stack draws none).
  const { rows: deck } = await db.query("SELECT i.id FROM public.items i WHERE i.is_catalog AND i.item_type = 'cocktail' AND NOT EXISTS (SELECT 1 FROM public.item_flavors f WHERE f.item_id = i.id) ORDER BY i.name LIMIT 24");
  for (const [n, d] of deck.entries()) {
    const v = (k) => ((n * 37 + k * 53) % 100) / 100;
    await db.query(
      "INSERT INTO public.item_flavors (item_id, sweet, sour, bitter, strong, herbal, fruity, smoky, spicy, creamy, botanical, spiced, savory, coverage, source, spec_fingerprint, rules_version) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 1, 'rules', 'seed-local', 0)",
      [d.id, v(1), v(2), v(3), 0.6 + v(4) * 0.4, v(5), v(6), v(7) * 0.4, v(8) * 0.4, v(9) * 0.3, v(10), v(11) * 0.5, v(12) * 0.3]
    );
  }
  const classic = Object.fromEntries(classics.map((c) => [c.name, c.id]));
  if (!classic.Negroni || !classic.Penicillin) throw new Error('The local catalog has no Negroni or Penicillin: run supabase db reset first.');

  // Bars, each a venue with its public page.
  const names = ["Caretaker's", 'Little Fern', 'Corner Room', 'Night Owl', 'Ash and Rye', 'Low Tide'];
  const bars = [];
  for (const [n, name] of names.entries()) {
    const { rows: [bar] } = await db.query("INSERT INTO public.bars (name, default_publish_mode) VALUES ($1, 'description') RETURNING id", [`${TAG} ${name}`]);
    const { rows: [profile] } = await db.query(
      "INSERT INTO public.profiles (kind, handle, display_name, bar_id, is_public, city, postcode, country_code, locality) VALUES ('bar', $1, $2, $3, true, 'New York', $4, 'US', 'Manhattan') RETURNING id",
      [`demorank${n}`, `${TAG} ${name}`, bar.id, n < 5 ? '10014' : '10012']
    );
    const { rows: [negroni] } = await db.query(
      "INSERT INTO public.items (item_type, name, bar_id, riff_of_id, origin, description) VALUES ('cocktail', 'Negroni', $1, $2, 'Classic', 'Gin, Campari and sweet vermouth, stirred.') RETURNING id",
      [bar.id, classic.Negroni]
    );
    bars.push({ id: bar.id, profile: profile.id, negroni: negroni.id });
  }
  const home = bars[0];
  const { rows: [penicillin] } = await db.query(
    "INSERT INTO public.items (item_type, name, bar_id, riff_of_id, origin) VALUES ('cocktail', 'Penicillin', $1, $2, 'Classic') RETURNING id",
    [home.id, classic.Penicillin]
  );
  const { rows: [signature] } = await db.query("INSERT INTO public.items (item_type, name, bar_id, origin) VALUES ('cocktail', 'Smoke Signal', $1, 'Original') RETURNING id", [home.id]);

  // The first bar's Negroni: version 1 long ago, version 2 twelve days ago.
  await db.query("INSERT INTO public.item_versions (item_id, version, snapshot, note, created_at) VALUES ($1, 1, '{\"lines\": 1}', NULL, now() - interval '300 days'), ($1, 2, '{\"lines\": 2}', 'Campari 30 to 25 ml', now() - interval '12 days')", [home.negroni]);
  const { rows: [menu] } = await db.query("INSERT INTO public.menus (bar_id, name, is_active, starts_at) VALUES ($1, 'Winter', true, now() - interval '20 days') RETURNING id", [home.id]);
  for (const item of [home.negroni, penicillin.id, signature.id]) await db.query('INSERT INTO public.menu_drinks (menu_id, item_id) VALUES ($1, $2)', [menu.id, item]);

  // demo@example.test runs the first bar and is credited with two of its drinks.
  const { rows: [demo] } = await db.query("SELECT u.id, p.id AS profile FROM auth.users u LEFT JOIN public.profiles p ON p.user_id = u.id AND p.kind = 'person' WHERE u.email = 'demo@example.test'");
  if (demo && !demo.profile) {
    // Credits need a person page; --remove takes this one out again.
    const { rows: [page] } = await db.query("INSERT INTO public.profiles (kind, user_id, handle, display_name) VALUES ('person', $1, 'demolocalranks', 'Demo Bartender') RETURNING id", [demo.id]);
    demo.profile = page.id;
  }
  if (demo) {
    await db.query('INSERT INTO public.user_bars (user_id, bar_id, role_level) VALUES ($1, $2, 40)', [demo.id, home.id]);
    if (demo.profile) {
      for (const item of [home.negroni, penicillin.id, bars[1].negroni]) {
        await db.query("INSERT INTO public.item_credits (item_id, role, profile_id, status) VALUES ($1, 'creator', $2, 'accepted')", [item, demo.profile]);
      }
    }
  } else {
    console.warn('No demo@example.test yet: run node scripts/dev-user.mjs, then this again, for the Admin and credit views.');
  }

  const reasons = [['order_again'], ['beautiful', 'order_again'], ['too_strong'], [], ['beautiful'], ['too_sweet'], ['order_again'], ['watery']];
  const rooms = [['great_room'], ['easy_to_talk', 'good_music'], ['loud'], ['great_room', 'cramped'], ['too_dark'], ['good_music']];
  const sentiments = ['loved', 'loved', 'loved', 'fine', 'loved', 'disliked', 'loved', 'fine'];
  const password = randomBytes(18).toString('base64url');
  for (let n = 0; n < RANKERS; n++) {
    const { data, error } = await admin.auth.admin.createUser({ email: EMAIL(n), password, email_confirm: true, user_metadata: { full_name: `Demo Ranker ${n + 1}` } });
    if (error) throw error;
    const user = data.user.id;
    await db.query("INSERT INTO private.age_checks (user_id, country_code, minimum_age, confirmed_at) VALUES ($1, 'US', 21, now()) ON CONFLICT (user_id) DO UPDATE SET confirmed_at = now()", [user]);
    const rank = (item, rankedAs, bar, onDay, k, i) =>
      db.query(
        'INSERT INTO public.rank_entries (user_id, item_id, ranked_as_item_id, venue_profile_id, sentiment, rank_key, had_on, created_at, reasons, room_reasons) VALUES ($1, $2, $3, $4, $5, $6, $7, $7::date + time \'21:00\', $8, $9)',
        [user, item, rankedAs, bar.profile, pick(sentiments, k), (k * 7 + i) % 11, daysAgo(onDay), pick(reasons, k + i), pick(rooms, k + i)]
      );
    // Every ranker has had the Negroni at most of the bars: a list of Negronis each.
    for (const [i, bar] of bars.entries()) {
      if (i > 0 && (n + i) % 7 === 6) continue;
      // The first bar: 20 before the spec changed, 160 to 274 days ago (so six months of history, most counting half), the last 6 since.
      const onDay = i === 0 ? (n < 20 ? 160 + n * 6 : 1 + (n - 20) * 2) : 5 + ((n * 13 + i * 29) % 230);
      await rank(bar.negroni, classic.Negroni, bar, onDay, n, i);
    }
    if (n < 12) await rank(penicillin.id, classic.Penicillin, home, 3 + n * 4, n + 1, 0);
    if (n < 14) await rank(signature.id, signature.id, home, 2 + n * 3, n + 2, 0);
  }
  await db.query('SELECT private.refresh_rankings()');
  console.log(`Added ${bars.length} ${TAG} bars and ${RANKERS} rankers. The first bar is ${TAG} ${names[0]} (/p/demorank0); its Negroni is /cocktail/${home.negroni}.`);
}

try {
  if (process.argv.includes('--remove')) {
    await remove();
    console.log(`Removed the ${TAG} bars, their drinks and rankers.`);
  } else {
    await add();
  }
} finally {
  await db.end();
}
