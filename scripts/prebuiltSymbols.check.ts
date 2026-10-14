import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { globSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Expo ships some iOS modules as prebuilt xcframeworks, compiled against
// whatever ExpoModulesCore was current when they were published. A module
// newer than our core can call a symbol our core doesn't export, and dyld
// kills the app at launch before any JS runs. expo-print 58.0.6 did this to
// iOS 1.4.0 build 32 (AppContext.fileSystem, core 58.0.11): pinned to 58.0.4.
// This links every prebuilt module's ExpoModulesCore imports against the core
// we ship, so the next one fails here instead of on a phone.
// ponytail: needs an nm that reads arm64 Mach-O (Xcode's, or llvm-nm); it skips
// where there is none. Unpin expo-print when we move to a newer expo-modules-core.

// GNU nm (Linux's default) runs but can't read Mach-O, so each candidate is
// tried on the core binary below. Ubuntu keeps llvm-nm under /usr/lib/llvm-N.
const nms = [
  'llvm-nm',
  ...globSync('/usr/lib/llvm-*/bin/llvm-nm').sort().reverse(),
  ...globSync('/usr/bin/llvm-nm-*').sort().reverse(),
  'nm',
];

function symbols(nm: string, binary: string, flag: '-gU' | '-u'): string[] | null {
  // -gU (Apple) is "defined globals"; llvm-nm spells it --defined-only.
  const args = flag === '-u' ? ['-u', binary] : ['-g', '--defined-only', binary];
  const out = spawnSync(nm, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (out.status !== 0) return null;
  return out.stdout
    .split('\n')
    .map((line) => line.trim().split(/\s+/).pop() ?? '')
    .filter((s) => s.startsWith('_$s15ExpoModulesCore'));
}

function unpack(tarball: string, dir: string, framework: string): string {
  spawnSync('tar', ['xzf', tarball, '-C', dir]);
  const [binary] = globSync(join(dir, `**/ios-arm64/${framework}.framework/${framework}`));
  assert.ok(binary, `${tarball}: no ios-arm64 ${framework} binary`);
  return binary;
}

const release = 'prebuilds/output/release/xcframeworks';
const coreTarball = `node_modules/expo-modules-core/${release}/ExpoModulesCore.tar.gz`;
const work = mkdtempSync(join(tmpdir(), 'prebuilt-symbols-'));

try {
  const coreBinary = globSync(coreTarball).length ? unpack(coreTarball, work, 'ExpoModulesCore') : null;
  let nm = '';
  let core: string[] | null = null;
  for (const bin of coreBinary ? nms : []) {
    core = symbols(bin, coreBinary!, '-gU');
    if (core?.length) {
      nm = bin;
      break;
    }
  }
  if (!core?.length) {
    console.log('prebuiltSymbols skipped (no nm for Mach-O, or no core prebuild)');
  } else {
    const exported = new Set(core);
    const coreVersion = JSON.parse(readFileSync('node_modules/expo-modules-core/package.json', 'utf8')).version;
    const tarballs = globSync(`node_modules/{*,@*/*}/${release}/*.tar.gz`).filter((t) => !t.includes('/expo-modules-core/'));
    for (const tarball of tarballs) {
      const pkg = tarball.slice('node_modules/'.length, tarball.indexOf(`/${release}`));
      const framework = tarball.split('/').pop()!.replace('.tar.gz', '');
      const imports = symbols(nm, unpack(tarball, work, framework), '-u') ?? [];
      const missing = imports.filter((s) => !exported.has(s));
      const version = JSON.parse(readFileSync(`node_modules/${pkg}/package.json`, 'utf8')).version;
      assert.deepEqual(missing, [], `${pkg}@${version} (${framework}) needs symbols expo-modules-core@${coreVersion} lacks; the app would die at launch. Pin ${pkg} to an exact version built against this core.`);
    }
    console.log(`prebuiltSymbols ✓ (${tarballs.length} prebuilt modules against expo-modules-core ${coreVersion}, ${nm})`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
