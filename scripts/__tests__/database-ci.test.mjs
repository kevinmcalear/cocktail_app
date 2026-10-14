import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { needsDatabase, testedAppFiles } from '../database-ci.mjs';

// A PR skips "Migrations and security tests" only when it touches nothing the
// job reads. Getting this wrong lets a broken migration or column list merge.

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'database-ci.mjs');
const run = (input) => execFileSync('node', [SCRIPT], { input, encoding: 'utf8' }).trim();

test('the app files the security tests read count, with what they import', () => {
  const tested = testedAppFiles();
  for (const f of ['hooks/useBarFacts.ts', 'hooks/useProfiles.ts', 'lib/drinkStyles.ts', 'lib/discover.ts', 'lib/flavor.ts']) {
    assert.ok(tested.has(f), `${f} should be watched`);
  }
  // useBarFacts.ts is only read as text, so what it imports doesn't count.
  assert.ok(!tested.has('lib/supabase.ts'));
});

test('database, test, package and CI changes run the job', () => {
  for (const f of ['supabase/migrations/20990101000000_x.sql', 'supabase/tests/x.test.mjs', 'supabase/functions/x/index.ts', 'package-lock.json', '.github/workflows/ci.yml', 'lib/drinkStyles.ts']) {
    assert.equal(needsDatabase(['components/x.tsx', f]), true, f);
  }
});

test('UI-only changes skip it', () => {
  assert.equal(needsDatabase(['components/screens/drink/ServiceSpec.tsx', 'lib/service.ts', 'app/(tabs)/index.tsx', 'docs/dev_flow.md']), false);
});

test('the CLI prints a GitHub output line, and runs the job when given no files', () => {
  assert.equal(run('components/x.tsx\n'), 'database=false');
  assert.equal(run('components/x.tsx\nsupabase/migrations/x.sql\n'), 'database=true');
  assert.equal(run(''), 'database=true');
});
