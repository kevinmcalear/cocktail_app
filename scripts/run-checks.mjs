// Runs every `*.check.ts` / `*.selfcheck.ts` assertion script with tsx and
// fails if any of them throws. Usage: npm run test:unit
import { spawnSync } from 'node:child_process';
import { globSync } from 'node:fs';

const files = globSync('{app,components,hooks,lib,store,ctx}/**/*.{check,selfcheck}.ts').sort();
if (files.length === 0) {
  console.error('No check scripts found.');
  process.exit(1);
}

const failed = [];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', file], { stdio: 'inherit' });
  if (result.status !== 0) failed.push(file);
}

console.log(`\n${files.length - failed.length}/${files.length} check scripts passed.`);
if (failed.length) {
  console.error(`Failed:\n  ${failed.join('\n  ')}`);
  process.exit(1);
}
