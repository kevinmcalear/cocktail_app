import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'design-ratchet.mjs');

function run(source, baseline = { violations: {}, longFiles: {} }) {
  const dir = mkdtempSync(join(tmpdir(), 'design-ratchet-'));
  mkdirSync(join(dir, 'components'));
  mkdirSync(join(dir, 'scripts'));
  writeFileSync(join(dir, 'components', 'Card.tsx'), source);
  writeFileSync(join(dir, 'scripts', 'design-ratchet.baseline.json'), JSON.stringify(baseline));
  return spawnSync(process.execPath, [SCRIPT], { cwd: dir, encoding: 'utf8' });
}

test('tokens pass', () => {
  const r = run('export const C = () => <Text fontSize="$5" color="$color" borderRadius="$4" style={{ borderRadius: 0 }} />;');
  assert.equal(r.status, 0, r.stderr);
});

test('raw colour, font size and radius in a new file fail', () => {
  for (const src of [
    'const s = { color: "#FF0000" };',
    'const s = { backgroundColor: "rgba(0,0,0,0.5)" };',
    'const s = { fontSize: 13 };',
    'export const C = () => <Text fontSize={11} />;',
    'const s = { borderRadius: 12 };',
    'export const C = () => <View br={8} />;',
    'export const f = (x: any) => x;',
    'export const C = () => { supabase.from("items").select(); return null; };',
  ]) {
    const r = run(src);
    assert.equal(r.status, 1, `expected failure for: ${src}`);
  }
});

test('existing violations up to the baseline pass, one more fails', () => {
  const baseline = { violations: { 'components/Card.tsx': 1 }, longFiles: {} };
  assert.equal(run('const s = { fontSize: 13 };', baseline).status, 0);
  assert.equal(run('const s = { fontSize: 13, borderRadius: 4 };', baseline).status, 1);
});

test('a new screen file over the line limit fails', () => {
  const long = Array.from({ length: 320 }, (_, i) => `const a${i} = ${i};`).join('\n');
  assert.equal(run(long).status, 1);
});
