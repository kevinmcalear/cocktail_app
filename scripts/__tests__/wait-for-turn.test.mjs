import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JOB_NAME, STEP_NAME, myTurn } from '../wait-for-turn.mjs';

const waiting = (id) => ({ id, name: JOB_NAME, status: 'in_progress', steps: [{ name: STEP_NAME, status: 'in_progress' }] });
const holding = (id) => ({ id, name: JOB_NAME, status: 'in_progress', steps: [{ name: STEP_NAME, status: 'completed' }] });

test('the only job goes at once', () => {
  assert.equal(myTurn([waiting(5)], 5), true);
});

test('waits while another job holds the slot', () => {
  assert.equal(myTurn([holding(1), waiting(2)], 2), false);
  assert.equal(myTurn([holding(9), waiting(2)], 2), false);
});

test('the lowest waiting id goes first, the rest wait', () => {
  const jobs = [waiting(3), waiting(1), waiting(2)];
  assert.equal(myTurn(jobs, 1), true);
  assert.equal(myTurn(jobs, 2), false);
  assert.equal(myTurn(jobs, 3), false);
});

test('a finished or queued job, or another job in the workflow, never blocks', () => {
  const jobs = [
    { ...holding(1), status: 'completed' },
    { ...waiting(2), status: 'queued' },
    { id: 3, name: 'Typecheck, lint, unit tests, web build', status: 'in_progress', steps: [] },
    waiting(4),
  ];
  assert.equal(myTurn(jobs, 4), true);
});

test('when the holder is cancelled the next waiter goes', () => {
  assert.equal(myTurn([waiting(2), waiting(3)], 2), true);
});
