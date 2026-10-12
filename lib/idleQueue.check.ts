import assert from 'node:assert/strict';

import { QueryClient } from '@tanstack/react-query';

import { afterFirstData, SLICE_MS, whenIdle } from './idleQueue';

// A fake clock and scheduler: each job "takes" 3 ms; slices run when we say.
let clock = 0;
const now = () => clock;
const slices: (() => void)[] = [];
const schedule = (run: () => void) => slices.push(run);
const ran: number[] = [];
const job = (n: number, ms = 3) => () => {
  clock += ms;
  ran.push(n);
};

for (let n = 1; n <= 7; n++) whenIdle(job(n), schedule, now);
assert.equal(slices.length, 1, 'one slice scheduled for the whole batch');

// A slice stops once it has used its budget: 3 jobs of 3 ms fit an 8 ms slice.
assert.equal(SLICE_MS, 8);
slices.shift()!();
assert.deepEqual(ran, [1, 2, 3]);
assert.equal(slices.length, 1, 'the rest wait for the next slice');

// A job slower than a slice still runs, alone, and the queue keeps going.
whenIdle(job(8, 40), schedule, now);
slices.shift()!(); // 4, 5, 6
assert.deepEqual(ran, [1, 2, 3, 4, 5, 6]);
slices.shift()!(); // 7, then the slow 8
assert.deepEqual(ran, [1, 2, 3, 4, 5, 6, 7, 8], 'every job runs, in order');
assert.equal(slices.length, 0, 'nothing left scheduled');

// A new job after the queue drained schedules a fresh slice.
whenIdle(job(9), schedule, now);
assert.equal(slices.length, 1);
slices.shift()!();
assert.deepEqual(ran.at(-1), 9);

void (async () => {
  // afterFirstData: waits for the first queries to fetch and settle, not for a
  // cache that's merely quiet before anything started.
  const client = new QueryClient();
  let fonts = 0;
  afterFirstData(client, () => fonts++, 60_000);
  let resolve!: (v: string) => void;
  const fetching = client.fetchQuery({ queryKey: ['first'], queryFn: () => new Promise<string>((r) => (resolve = r)) });
  client.setQueryData(['quiet'], 1);
  assert.equal(fonts, 0, 'not while the first screen is still fetching');
  resolve('data');
  await fetching;
  assert.equal(fonts, 1, 'once its data is in');
  client.setQueryData(['later'], 2);
  assert.equal(fonts, 1, 'only once');

  // With nothing to fetch (a signed-out page), the cap starts it.
  let capped = 0;
  afterFirstData(new QueryClient(), () => capped++, 5);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(capped, 1);
  client.clear();

  console.log('idleQueue: ok');
})();
