// Fields due to drop: the old homes of facts that moved in 20261203100000,
// 20261204300000 and 20261204400000 (lists and runs, one home, takeovers).
// See docs/one_home_drop.md. Old app builds still
// read them, so they stay until 2.0 is on every phone, then drop in one PR
// (as #1009 did). App code must not gain reads of them: this compares every
// file in app/, components/, hooks/, lib/, ctx/ and store/ with a checked-in
// baseline and fails when a file reads an old field more than it did. When a
// screen moves to the new home, lower the baseline:
//
//   npx tsx scripts/oldFields.check.ts            check (npm run test:unit)
//   npx tsx scripts/oldFields.check.ts --update   rewrite the baseline
//
// The drop PR needs every count at zero.
// ponytail: a whole-word match on the column name, per file. Glass and ice
// kept their column names in drink_glass and drink_ice, so a word can't tell
// an old read from a new one: those are checked in the database before the
// drop (docs/one_home_drop.md). A comment that names an old field counts
// until it's reworded.
import assert from 'node:assert/strict';
import { globSync, readFileSync, writeFileSync } from 'node:fs';

/** Old field (as app code names it) -> its one home now. */
export const OLD_FIELDS: Record<string, string> = {
  // Lists and runs (20261203100000)
  menu_drink_runs: 'rpc drink_list_dates',
  // Run names apart (20261204300000)
  bar_off_menu: 'bar_also_makes ("Also makes")',
  // Permissions decide amounts (20261204300000)
  default_generic_ingredient_level: 'role permissions (talking_points, specs)',
  default_specific_brand_level: 'role permissions (specs)',
  default_measurement_level: 'role permissions (specs)',
  default_prep_level: 'role permissions (house_made)',
  override_generic_ingredient_level: 'items.spec_hidden',
  override_specific_brand_level: 'items.spec_hidden',
  override_measurement_level: 'items.spec_hidden',
  override_prep_level: 'items.spec_hidden',
  // One based-on link and one family (20261204300000)
  riff_of_id: "items.based_on_id with based_on_kind 'riff'",
  lineage_parent_id: "items.based_on_id with based_on_kind 'descends'",
  lineage_style_id: 'items.based_on_style_id',
  spec_from_id: "items.based_on_id while spec_source is 'classic'",
  lineage_family: 'items.drink_family (the tree reads private.family_key)',
  family_id: 'items.drink_family',
  // One credit relation (20261204300000)
  creator_profile_id: "item_credits (role 'creator')",
  creator_names: "item_credits (role 'creator', a plain name)",
  credit_status: 'item_credits.status',
  item_co_creators: "item_credits (role 'co_creator')",
  item_maker_credits: "item_credits (role 'maker')",
  // One had record and one Want list (20261204300000)
  collected_items: 'drinks_had (memories) and want_list (to make)',
  made_drinks: "drinks_had (source 'made')",
  // Advanced options, the one venue switch kept (20261204300000)
  enabled_features: 'bars.advanced_options',
  venue_feature_events: 'nothing (the venue feature switches are gone)',
  // Takeovers (20261204400000)
  guest_role_id: 'menus.change_role_id (the takeover list names its guest role)',
};

const BASELINE = 'scripts/old-fields.baseline.json';
const SOURCES = '{app,components,hooks,lib,ctx,store}/**/*.{ts,tsx}';

type Counts = Record<string, Record<string, number>>;

function count(): Counts {
  const out: Counts = {};
  for (const file of globSync(SOURCES).sort()) {
    const text = readFileSync(file, 'utf8');
    for (const field of Object.keys(OLD_FIELDS)) {
      const n = text.match(new RegExp(`\\b${field}\\b`, 'g'))?.length ?? 0;
      if (n) (out[field] ??= {})[file] = n;
    }
  }
  return out;
}

const now = count();
if (process.argv.includes('--update')) {
  writeFileSync(BASELINE, `${JSON.stringify(now, null, 2)}\n`);
  const total = Object.values(now).reduce((sum, files) => sum + Object.values(files).reduce((a, b) => a + b, 0), 0);
  console.log(`oldFields: baseline written, ${total} reads of old fields left.`);
} else {
  const base: Counts = JSON.parse(readFileSync(BASELINE, 'utf8'));
  const worse: string[] = [];
  for (const [field, files] of Object.entries(now)) {
    for (const [file, n] of Object.entries(files)) {
      const was = base[field]?.[file] ?? 0;
      if (n > was) worse.push(`${file}: ${field} ${was} -> ${n} (read ${OLD_FIELDS[field]} instead)`);
    }
  }
  assert.deepEqual(worse, [], `app code reads a field due to drop:\n  ${worse.join('\n  ')}`);
  console.log('oldFields.check: ok');
}
