// The venue feature switches (lib/venueFeatures.ts): reading and switching,
// and that every way into a section asks its switch. Run by npm run test:unit.
import assert from 'node:assert/strict';
import { globSync, readdirSync, readFileSync } from 'node:fs';

import { shownTabs, TABS } from './tabs';
import {
  ALWAYS_ON,
  featureAtHome,
  featureSaveMessage,
  featureShown,
  isMissingColumn,
  parseFeatures,
  readFeatures,
  SWITCHES,
  VENUE_FEATURES,
  venueHome,
  withFeature,
  type VenueFeatureKey,
} from './venueFeatures';

const on = (...keys: VenueFeatureKey[]) => (k: VenueFeatureKey) => keys.includes(k);

// --- parsing and switching ---
assert.deepEqual(parseFeatures(null), []);
assert.deepEqual(parseFeatures(['prep', 'nightclub', 3, 'tonight']), ['prep', 'nightclub', 'tonight'], 'unknown keys are kept, so a write never drops them');
assert.deepEqual(withFeature(['nightclub', 'study'], 'tonight', true), ['tonight', 'study', 'nightclub'], 'a key a newer app added stays');
assert.deepEqual(withFeature(['nightclub', 'study'], 'study', false), ['nightclub']);
assert.deepEqual(withFeature(['tonight', 'study'], 'tonight', false), ['study']);
assert.equal(featureAtHome('prep'), false, 'home never had Prep');
assert.equal(featureAtHome('tonight'), true, 'home keeps its Tonight');
assert.equal(featureShown('history', null), true, 'at home: atHome');
assert.equal(featureShown('history', []), false, 'at a venue: off until switched on');
assert.equal(featureShown('history', ['history']), true);

// --- a read never throws ---
assert.deepEqual(readFeatures(null, { code: '42703' }, ['tonight']), [], 'no column: none');
assert.deepEqual(readFeatures(null, { code: 'PGRST301' }, ['tonight']), ['tonight'], 'offline or a timeout keeps what was saved');
assert.deepEqual(readFeatures(null, { code: '08006' }), [], 'and none when nothing was saved');
assert.deepEqual(readFeatures({ enabled_features: null }, null), [], 'a null value: none');
assert.deepEqual(readFeatures({ enabled_features: ['tonight', 'disco'] }, null), ['tonight', 'disco']);
assert.ok(isMissingColumn({ code: '42703' }) && !isMissingColumn(null) && !isMissingColumn({ code: '42501' }));
assert.match(featureSaveMessage({ code: '42501' }), /Check your connection/);

// --- Tonight: switchable, one line to fix it on (ALWAYS_ON) ---
assert.ok(!ALWAYS_ON.includes('tonight') && SWITCHES.some((f) => f.key === 'tonight'), 'Tonight is a switch (Kevin, 3 Nov 2026)');
assert.deepEqual(shownTabs(on('tonight')).map((t) => t.name), ['tonight', 'drinks', 'discover', 'you']);
assert.deepEqual(shownTabs(on()).map((t) => t.name), ['drinks', 'discover', 'you'], 'Tonight off: three tabs, no empty slot');
assert.equal(venueHome(on('tonight')), '/');
assert.equal(venueHome(on()), '/drinks', 'Tonight off: the app opens on Drinks');
assert.equal(TABS.find((t) => t.name === 'drinks')?.path, '/drinks');

// --- the database allows each key ---
const dir = new URL('../supabase/migrations/', import.meta.url);
const sql = readdirSync(dir).sort().map((f) => readFileSync(new URL(f, dir), 'utf8')).filter((s) => /ADD CONSTRAINT "bars_enabled_features_known"/.test(s)).at(-1);
assert.ok(sql, 'a migration sets the switches constraint');
const allowed = sql.match(/ARRAY\[([^\]]+)\]/)![1].match(/'([^']+)'/g)!.map((s) => s.slice(1, -1));
for (const f of VENUE_FEATURES) assert.ok(allowed.includes(f.key), `${f.key} is allowed by bars_enabled_features_known`);

// --- every entry point asks its switch ---
// Each file that opens a section, by the switch it must read: useVenueFeature('key'),
// useBarFeature(..., 'key'), has('key'), <FeatureGate feature="key">, a `feature: 'key'` row filtered by has, or useBackBarShown().
const ENTRY: Record<VenueFeatureKey, readonly string[]> = {
  tonight: [
    'components/nav/AppTabs.tsx',
    'components/nav/WebTabBar.tsx',
    'app/(tabs)/(1-tonight)/index.tsx',
    'app/week/index.tsx',
    'app/week/review.tsx',
    'components/bar/VenueSettingsLinks.tsx',
    'components/screens/menus/MenusScreen.tsx',
  ],
  backBar: [
    'app/back-bar.tsx',
    'app/back-bar-labels.tsx',
    'components/bar/VenueSettingsLinks.tsx',
    'components/backbar/BackBarLink.tsx',
    'components/backbar/WhereItLives.tsx',
    'components/screens/make/useMakeSpot.ts',
    'components/screens/ingredient/edit/IngredientEditScreen.tsx',
  ],
  prep: ['app/(tabs)/(1-tonight,2-drinks,3-discover,4-you)/prep.tsx', 'components/nav/sidePlaces.ts', 'hooks/useMenuLens.ts', 'components/screens/ingredient/BehindTheBar.tsx'],
  study: ['app/(tabs)/(1-tonight,2-drinks,3-discover,4-you)/test.tsx', 'app/study/[deck].tsx', 'components/bar/VenueSettingsLinks.tsx', 'components/screens/tonight/useStaffTonight.ts'],
  history: ['app/history.tsx', 'components/search/SearchPanel.tsx', 'components/screens/drink/Backstory.tsx'],
  flavorMap: ['app/flavor-map.tsx', 'components/search/SearchPanel.tsx', 'components/screens/learn/LearnScreen.tsx', 'components/screens/pairings/PairsWith.tsx', 'components/screens/addDrink/GoesWith.tsx'],
  techniques: [
    'app/(tabs)/(1-tonight,2-drinks,3-discover,4-you)/learn.tsx',
    'app/(tabs)/(1-tonight,2-drinks,3-discover,4-you)/techniques/index.tsx',
    'app/(tabs)/(1-tonight,2-drinks,3-discover,4-you)/techniques/[id].tsx',
    'app/(tabs)/(1-tonight,2-drinks,3-discover,4-you)/techniques/foam.tsx',
    'app/(tabs)/(1-tonight,2-drinks,3-discover,4-you)/equipment/index.tsx',
    'app/(tabs)/(1-tonight,2-drinks,3-discover,4-you)/equipment/[id].tsx',
    'components/search/SearchPanel.tsx',
    'components/search/PaletteResults.tsx',
    'components/screens/home/DiscoverScreen.tsx',
    'components/screens/tonight/StaffTonight.tsx',
    'components/screens/ingredient/IngredientBits.tsx',
    'components/techniques/TechnicalIngredientCard.tsx',
    'components/screens/make/MakeSteps.tsx',
  ],
  libraryExtras: ['components/screens/drinks/useStaffDrinks.ts', 'components/search/SearchPanel.tsx'],
  advanced: ['components/bar/VenueSettingsLinks.tsx', 'components/screens/venueSetup/KitStep.tsx', 'components/screens/venue/GlasswareScreen.tsx', 'hooks/useGlassFill.ts'],
};

const asks = (text: string, key: VenueFeatureKey) =>
  new RegExp(`\\b(useVenueFeature|has|includes)\\(\\s*'${key}'|useBarFeature\\([^,)]*,\\s*'${key}'|feature(="|: ')${key}['"]`).test(text) ||
  (key === 'backBar' && /useBackBarShown\(\)/.test(text)) ||
  // The tab lists ask through shownTabs/useWebTabs.
  (key === 'tonight' && /\b(useWebTabs|shownTabs)\(/.test(text));
for (const f of VENUE_FEATURES) {
  for (const file of ENTRY[f.key]) {
    const text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.ok(asks(text, f.key), `${file} opens ${f.label}, so it asks the ${f.key} switch`);
  }
}
assert.match(readFileSync(new URL('../components/screens/menus/page/menuPageModel.ts', import.meta.url), 'utf8'), /L\.prep \? \[\{ label: 'House-made for this menu'/, 'a menu links its prep list only with Prep on');
assert.ok(/useBarFeature\(barId, 'advanced'\)|has\('advanced'\)|includes\('advanced'\)/.test(readFileSync(new URL('../hooks/useGlassFill.ts', import.meta.url), 'utf8')), 'Fit it waits for Advanced options');

// A new link to a section's page must be listed above (and ask its switch), or be the section's own page.
const SECTION_PATH = /[`'"]\/(prep|test|study|week|back-bar|history|flavor-map|techniques|equipment|learn)\b/;
const listed = new Set(Object.values(ENTRY).flat());
// Pages inside a section (they only open from it), and home mode's own pages (home keeps `atHome`).
const INSIDE = [
  /^components\/(backbar|techniques)\//,
  /^components\/screens\/(techniques|week|study|flavorMap|learn)\//,
  /^components\/screens\/(StudyScreen|BackBarScreen|PrepScreen)\.tsx$/,
  /^components\/screens\/home\/(Projects|SectionCards|BarSections)\.tsx$/,
  /^components\/screens\/tonight\/HomeTonight\.tsx$/,
  /^hooks\/useBarKit\.ts$/,
  /^components\/screens\/ingredient\/edit\/EditSections\.tsx$/,
  // Its Prep action only runs from the Prep list row, which menuPageModel shows with useMenuLens's `prep`.
  /^components\/screens\/menus\/MenuScreen\.tsx$/,
];
for (const file of globSync('{app,components,hooks}/**/*.{ts,tsx}').sort()) {
  if (/\.(test|check)\.tsx?$/.test(file) || listed.has(file) || INSIDE.some((r) => r.test(file))) continue;
  const text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  assert.ok(!SECTION_PATH.test(text), `${file} links into a switchable section: list it in ENTRY and ask its switch`);
}

console.log('venueFeatures checks passed');
