import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

import { featureAtHome, featureSaveMessage, isMissingColumn, parseFeatures, phoneTabs, readFeatures, PHONE_TAB_LIMIT, VENUE_FEATURES, venueTabs, withFeature, type VenueFeatureKey } from './venueFeatures';

const on = (...keys: VenueFeatureKey[]) => (k: VenueFeatureKey) => keys.includes(k);

// --- parsing and switching ---
assert.deepEqual(parseFeatures(null), []);
assert.deepEqual(parseFeatures(['prep', 'nightclub', 3, 'tonight']), ['prep', 'tonight'], 'unknown keys are dropped');
assert.deepEqual(withFeature(['study'], 'tonight', true), ['tonight', 'study'], 'catalog order');
assert.deepEqual(withFeature(['tonight', 'study'], 'tonight', false), ['study']);
assert.equal(featureAtHome('prep'), false, 'home never had Prep');
assert.equal(featureAtHome('history'), true);

// --- reading before the migration has run (order-safe deploys) ---
assert.deepEqual(readFeatures(null, { code: '42703' }, ['tonight']), [], 'no column yet: the default three');
assert.deepEqual(readFeatures(null, { code: 'PGRST204' }), []);
assert.deepEqual(readFeatures(null, { code: 'PGRST301' }, ['tonight']), ['tonight'], 'offline or a timeout keeps what was saved');
assert.deepEqual(readFeatures(null, { code: '08006' }), [], 'and none when nothing was saved');
assert.deepEqual(readFeatures(null, null), [], 'no row: none');
assert.deepEqual(readFeatures({ enabled_features: null }, null), [], 'a null value: none');
assert.deepEqual(readFeatures({ enabled_features: ['tonight', 'disco'] }, null), ['tonight']);
assert.ok(isMissingColumn({ code: '42703' }) && !isMissingColumn(null) && !isMissingColumn({ code: '42501' }));
assert.match(featureSaveMessage({ code: 'PGRST204' }), /after the next update/);
assert.match(featureSaveMessage({ code: '42501' }), /Check your connection/);

// --- tabs ---
assert.deepEqual(venueTabs(on()), ['library', 'menus', 'discover'], 'the first release: Library, Menus, Discover');
assert.deepEqual(venueTabs(on('tonight'), PHONE_TAB_LIMIT), ['index', 'library', 'menus', 'discover']);
assert.deepEqual(venueTabs(on('tonight', 'prep'), PHONE_TAB_LIMIT), ['index', 'library', 'prep', 'discover'], 'Menus gives way when Tonight carries it');
assert.deepEqual(venueTabs(on('prep', 'study'), PHONE_TAB_LIMIT), ['library', 'menus', 'prep', 'discover'], 'without Tonight, Menus stays');
assert.deepEqual(venueTabs(on('tonight', 'prep', 'study'), PHONE_TAB_LIMIT), ['index', 'library', 'prep', 'discover']);
assert.deepEqual(venueTabs(on('tonight', 'prep', 'study')), ['index', 'library', 'menus', 'prep', 'test', 'discover'], 'the sidebar has room for all');

// --- a phone bar never passes five items (Search included), in any mode or switches ---
const keys = VENUE_FEATURES.map((f) => f.key);
for (let mask = 0; mask < 1 << keys.length; mask++) {
  const has = on(...keys.filter((_, i) => mask & (1 << i)));
  for (const home of [false, true]) {
    const items = [...phoneTabs(home, has), 'search'];
    const what = `${home ? 'home' : 'venue'} ${keys.filter((_, i) => mask & (1 << i)).join('+') || 'default'}`;
    assert.ok(items.length <= PHONE_TAB_LIMIT + 1, `${what}: ${items.join(', ')}`);
    assert.equal(new Set(items).size, items.length, `${what}: no repeats`);
    assert.ok(items.includes('new'), `${what}: New is always a tab`);
    assert.ok(items.includes('discover'), `${what}: Discover is always there`);
    if (!home) assert.ok(items.includes('library') && (items.includes('index') || items.includes('menus')), `${what}: Library, and Tonight or Menus`);
  }
}
assert.deepEqual(phoneTabs(true, on()), ['discover', 'bar', 'collection', 'new'], 'at home, You makes room for New');
assert.deepEqual(phoneTabs(false, on()), ['library', 'menus', 'discover', 'new'], 'the default venue has room');
assert.deepEqual(phoneTabs(false, on('tonight')), ['index', 'library', 'discover', 'new'], 'Menus gives way first when Tonight carries it');
assert.deepEqual(phoneTabs(false, on('prep', 'study')), ['library', 'menus', 'discover', 'new'], 'then Study, then Prep');
assert.deepEqual(phoneTabs(false, on('tonight', 'prep', 'study')), ['index', 'library', 'discover', 'new']);

// --- the database allows exactly these keys (plus any a later PR adds there first) ---
const dir = new URL('../supabase/migrations/', import.meta.url);
const sql = readdirSync(dir).filter((f) => f.endsWith('venue_feature_switches.sql')).map((f) => readFileSync(new URL(f, dir), 'utf8'))[0];
assert.ok(sql, 'the switches migration exists');
const allowed = sql.match(/ARRAY\[([^\]]+)\]/)![1].match(/'([^']+)'/g)!.map((s) => s.slice(1, -1));
for (const f of VENUE_FEATURES) assert.ok(allowed.includes(f.key), `${f.key} is allowed by bars_enabled_features_known`);

console.log('venueFeatures checks passed');
