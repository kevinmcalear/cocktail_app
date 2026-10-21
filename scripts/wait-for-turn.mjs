// A queue for CI's "Migrations and security tests" job. Only one database
// rebuild runs at a time (two at once is what pushed runs into the timeout),
// but unlike a GitHub concurrency group, no waiting run is ever cancelled:
// a group keeps one running and ONE pending run, so every newer run kills the
// pending one.
//
//   node scripts/wait-for-turn.mjs   (needs GH_TOKEN, GITHUB_REPOSITORY, JOB_ID)
//
// Every database job starts at once and runs this as its first step. A job
// holds the slot once this step has completed, and waits while another job
// holds it or an earlier job (lower job id) is also waiting. Job ids only
// grow, so exactly one waiter is first. A cancelled or crashed job stops being
// in progress, which frees the slot. The wait gives up after MAX_WAIT_MIN and
// runs anyway: two rebuilds at once is slow, a PR that never runs is stuck.
import { fileURLToPath } from 'node:url';

export const JOB_NAME = 'Migrations and security tests';
export const STEP_NAME = 'Wait for turn';

/** Sorted ids of the jobs in line ahead of `me`, and whether the slot is held. */
export function ahead(jobs, me) {
  const live = jobs.filter((j) => j.name === JOB_NAME && j.status === 'in_progress' && j.id !== me);
  const held = live.some((j) => (j.steps ?? []).some((s) => s.name === STEP_NAME && s.status === 'completed'));
  const waiting = live
    .filter((j) => !(j.steps ?? []).some((s) => s.name === STEP_NAME && s.status === 'completed'))
    .filter((j) => j.id < me)
    .map((j) => j.id)
    .sort((a, b) => a - b);
  return { held, waiting };
}

export const myTurn = (jobs, me) => {
  const { held, waiting } = ahead(jobs, me);
  return !held && waiting.length === 0;
};

async function gh(path) {
  const res = await fetch(`https://api.github.com/${path}`, {
    headers: {
      authorization: `Bearer ${process.env.GH_TOKEN}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
    },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

async function activeJobs(repo) {
  const { workflow_runs } = await gh(`repos/${repo}/actions/workflows/ci.yml/runs?status=in_progress&per_page=100`);
  const lists = await Promise.all(workflow_runs.map((r) => gh(`repos/${repo}/actions/runs/${r.id}/jobs?per_page=100`)));
  return lists.flatMap((l) => l.jobs);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const repo = process.env.GITHUB_REPOSITORY;
  const me = Number(process.env.JOB_ID);
  const MAX_WAIT_MIN = 120;
  const POLL_MS = 30_000;
  const start = Date.now();
  let failures = 0;
  // Let jobs that started alongside this one show up in the API first: a job
  // only yields to a lower id it can see.
  await new Promise((r) => setTimeout(r, 15_000));
  for (;;) {
    try {
      const jobs = await activeJobs(repo);
      failures = 0;
      // A job we cannot find means the lookup is not trustworthy: do not wait on it.
      if (!jobs.some((j) => j.id === me) || myTurn(jobs, me)) break;
      const { held, waiting } = ahead(jobs, me);
      console.log(`Waiting: ${held ? 'another rebuild is running' : ''}${held && waiting.length ? ', ' : ''}${waiting.length ? `${waiting.length} earlier job(s) in line` : ''}`);
    } catch (e) {
      // ponytail: fail open after a few API errors; the ceiling is two rebuilds at once.
      console.log(`Could not read running jobs (${e.message})`);
      if (++failures >= 5) break;
    }
    if (Date.now() - start > MAX_WAIT_MIN * 60_000) {
      console.log(`Waited ${MAX_WAIT_MIN} minutes. Running anyway.`);
      break;
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  console.log(`Waited ${Math.round((Date.now() - start) / 1000)}s. Starting.`);
}
