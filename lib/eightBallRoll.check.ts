import assert from 'node:assert/strict';

import { AT_REST, isStill, MIN_HIT, screenGravity, stepRoll, type Bounds, type Roll } from './eightBallRoll';

const box: Bounds = { minX: -60, maxX: 60, minY: -200, maxY: 300 };
const frame = 1 / 60;

function run(start: Roll, seconds: number, gravity: { x: number; y: number } | null = null, bounds = box) {
  let roll = start;
  let hits = 0;
  let hardest = 0;
  for (let t = 0; t < seconds; t += frame) {
    const next = stepRoll(roll, gravity, bounds, frame);
    roll = next.roll;
    if (next.hitX > MIN_HIT || next.hitY > MIN_HIT) hits++;
    hardest = Math.max(hardest, next.hitX, next.hitY);
    assert.ok(roll.x >= bounds.minX && roll.x <= bounds.maxX, `x stays on screen: ${roll.x}`);
    assert.ok(roll.y >= bounds.minY && roll.y <= bounds.maxY, `y stays on screen: ${roll.y}`);
    assert.ok(Math.abs(roll.spin) <= Math.PI, `spin stays within half a turn: ${roll.spin}`);
    assert.ok(Math.abs(roll.dieX) <= 16 && Math.abs(roll.dieY) <= 16, 'the die stays in the window');
  }
  return { roll, hits, hardest };
}

// At rest it stays put, and the frame loop can sleep.
assert.deepEqual(stepRoll(AT_REST, null, box, frame).roll, AT_REST);
assert.ok(isStill(AT_REST, null));

// A fling sideways bounces off the walls, loses speed each time, then settles home.
const flung = run({ ...AT_REST, vx: 3000 }, 0.5);
assert.ok(flung.hits >= 2, `a hard fling bounces off both walls: ${flung.hits}`);
assert.ok(flung.hardest <= 3000, 'a bounce never adds speed');
const settled = run(flung.roll, 8).roll;
assert.ok(Math.abs(settled.x) < 1 && Math.abs(settled.vx) < 1, `settles home: ${JSON.stringify(settled)}`);
assert.ok(settled.depth < 0.05, 'the die has floated back up');
assert.ok(Math.abs(settled.spin) < 0.01, 'the ball has righted itself');

// While tumbling the die sinks, and trails the ball.
const tumbling = run({ ...AT_REST, vy: 2500 }, 0.1).roll;
assert.ok(tumbling.depth > 0.3, `the die sinks while the ball tumbles: ${tumbling.depth}`);
assert.ok(tumbling.dieY < 0, 'the die lags behind a ball moving down');

// Tilt is relative to how the phone was held when the ball opened.
const held = { x: 0, y: 7 }; // a phone held up to read (gravity runs down the screen)
const level = run(AT_REST, 1, held).roll;
assert.ok(level.levelled && Math.abs(level.y) < 1, `holding the phone still doesn't roll the ball: ${level.y}`);
const tipped = run(level, 0.6, { x: 4, y: 7 }).roll;
assert.ok(tipped.x > 20, `tipping right rolls it right: ${tipped.x}`);
// Held tipped, "level" catches up and the bowl brings the ball home.
const relevelled = run(tipped, 20, { x: 4, y: 7 }).roll;
assert.ok(Math.abs(relevelled.x) < 2, `relevels after a while: ${relevelled.x}`);

// A finger has it: the physics doesn't move the ball, but the die still sloshes.
const grabbed = stepRoll({ ...AT_REST, x: 30, vx: 800, held: true }, null, box, frame).roll;
assert.equal(grabbed.x, 30);
assert.ok(grabbed.dieVX < 0, 'the die reacts to a drag');
assert.ok(!isStill(grabbed, null));

// A long stall doesn't fling the ball through a wall.
const stalled = stepRoll({ ...AT_REST, vx: 4000 }, null, box, 2).roll;
assert.ok(stalled.x <= box.maxX);

// No reading yet (or no sensor): no tilt. Screen y runs down, the sensor's runs up.
assert.equal(screenGravity({ x: 0, y: 0, z: 0 }), null);
assert.deepEqual(screenGravity({ x: 1, y: -9.7, z: 0.5 }), { x: 1, y: 9.7 });

console.log('eightBallRoll checks passed');
