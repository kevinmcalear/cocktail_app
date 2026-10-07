import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build, glasswareFor, load, parseDate, pickVariant, report, titleCase } from './bar-history.mjs';

assert.deepEqual(parseDate('2024-05', 't'), { year: 2024, month: 5 });
assert.deepEqual(parseDate('2024', 't'), { year: 2024, month: null });
assert.deepEqual(parseDate(null, 't'), { year: null, month: null });
assert.throws(() => parseDate('2024-13', 't'));
assert.throws(() => parseDate('May 2024', 't'));
assert.equal(titleCase("hendrick's gin"), "Hendrick's Gin");
assert.equal(titleCase('oolong tea (cold brew)'), 'Oolong Tea (Cold Brew)');

// Shape notes pick a drawing only when they say so.
assert.equal(pickVariant('rocks', 'short tumbler with a heavy base'), 'rocks_heavy');
assert.equal(pickVariant('coupe', 'shallow saucer on a thin stem'), 'coupe_saucer');
assert.equal(pickVariant('nick', 'small rounded bowl on a tall stem'), null);
assert.equal(pickVariant('martini', null), null);

// The default glass of each type is the one most drinks use; a drink gets a
// variant only when it is drawn differently from that default.
const { rows, variants } = glasswareFor({
  glassware: [{ maker: 'Nude', shapes: [
    { name: 'Tumbler', sketch_shape: 'rocks', shape_note: 'tapered, wider at the rim' },
    { name: 'Heavy rocks', sketch_shape: 'rocks', shape_note: 'thick base' },
  ] }],
  drink_glasses: [
    { drink: 'A', glass: 'Tumbler', sketch_shape: 'rocks' },
    { drink: 'B', glass: 'Tumbler', sketch_shape: 'rocks' },
    { drink: 'C', glass: 'Heavy rocks', sketch_shape: 'rocks' },
  ],
});
assert.deepEqual(rows.map((r: { is_default: boolean }) => r.is_default), [true, false]);
assert.deepEqual(variants, [{ drink: 'C', glass: 'rocks', variant: 'rocks_heavy' }]);

// The research data parses, every bar reports coverage, and the SQL builds.
const bars = load();
assert.ok(bars.length > 0);
const sql: string = build(bars);
assert.equal(readFileSync('supabase/migrations/20261007190000_bar_history.sql', 'utf8'), sql, 'run node scripts/bar-history.mjs');
assert.match(sql, /ON CONFLICT ON CONSTRAINT "profile_menu_editions_once" DO NOTHING/);
assert.doesNotMatch(sql, /—|–/);
const table: string = report(bars);
assert.equal(table.trim().split('\n').length, bars.length + 2);

// The launch bars are in, with what we know of their glassware.
const cc = bars.find((b: { handle: string }) => b.handle === 'caretakers.cottage');
assert.ok(cc, "Caretaker's Cottage is researched");
for (const handle of ['bar.bellamy', 'abarwithshapesforaname']) {
  assert.ok(bars.some((b: { handle: string }) => b.handle === handle), `${handle} is researched`);
}

console.log(`bar-history: ${bars.length} bars ok`);
