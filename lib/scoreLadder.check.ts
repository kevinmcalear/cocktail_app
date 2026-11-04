// Checks for lib/scoreLadder.ts. Run: npm run test:unit
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

import { FLOORS, FULL_WEIGHT_DAYS, SCORE_LADDER } from './scoreLadder';

// The app's floors are the database's (private.score_floor), number for number.
const dir = new URL('../supabase/migrations/', import.meta.url);
const migrations = readdirSync(dir).sort().map((f) => readFileSync(new URL(f, dir), 'utf8'));
const latest = (marker: string) => {
  const sql = migrations.filter((s) => s.includes(marker)).pop();
  assert.ok(sql, `a migration makes ${marker}`);
  return sql.slice(sql.indexOf(marker));
};

const floorSql = latest('FUNCTION "private"."score_floor"("p_name" "text") RETURNS');
const dbFloor = (name: string) => Number(floorSql.match(new RegExp(`WHEN '${name}' THEN (\\d+)`))?.[1]);
assert.equal(dbFloor('bar_ranks'), FLOORS.barRanks);
assert.equal(dbFloor('list_bars'), FLOORS.listBars);
assert.equal(dbFloor('reasons'), FLOORS.reasons);
assert.equal(dbFloor('room'), FLOORS.room);
// people is private.ranking_min_rankers, which MIN_RANKERS already mirrors.
assert.match(floorSql, /WHEN 'people' THEN private\.ranking_min_rankers\(\)/);
const minSql = latest('FUNCTION "private"."ranking_min_rankers"() RETURNS');
assert.equal(Number(minSql.match(/SELECT (\d+)/)?.[1]), FLOORS.people);

// Full weight for FULL_WEIGHT_DAYS days, then half.
const weightSql = latest('FUNCTION "private"."score_weight"("p_on" "date"');
assert.match(weightSql, new RegExp(`p_at - ${FULL_WEIGHT_DAYS} THEN 1\\.0 ELSE 0\\.5`));

// The ladder's words carry the floors.
assert.equal(SCORE_LADDER.length, 5);
assert.match(SCORE_LADDER[1].when, new RegExp(`${FLOORS.barRanks} ranks`));
assert.match(SCORE_LADDER[2].when, new RegExp(`${FLOORS.people} people`));
assert.match(SCORE_LADDER[3].when, new RegExp(`${FLOORS.listBars} bars`));
