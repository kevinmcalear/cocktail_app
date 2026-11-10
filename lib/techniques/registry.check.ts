// The technique library's registry (lib/techniques/index.ts): empty answers
// before the data is in, full ones after, nothing cached from before; and the
// data reached only through import(), so it stays one lazy chunk on the web.
// Run: npm run test:unit
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { allEquipment, allTechniques, equipmentById, installTechniques, searchTechniques, techniqueById, techniquesLoaded } from './index';
import * as library from './library';
import { looksMadeInHouse, waysToMake } from './makeIt';

// Before the load: every getter answers as if the library were empty.
assert.equal(techniquesLoaded(), false);
assert.deepEqual(allTechniques(), []);
assert.deepEqual(allEquipment(), []);
assert.equal(techniqueById('milk-wash'), undefined);
assert.equal(equipmentById('whipper'), undefined);
assert.deepEqual(searchTechniques('milk'), []);
assert.deepEqual(waysToMake('Bacon bourbon'), []);

installTechniques(library);

// After it: full answers, and nothing worked out from the empty library was kept (makeIt's other names).
assert.equal(techniquesLoaded(), true);
assert.equal(allTechniques().length, library.TECHNIQUES.length);
assert.equal(allEquipment().length, library.EQUIPMENT.length);
assert.equal(techniqueById('milk-wash')?.name, 'Milk washing');
assert.equal(equipmentById('whipper')?.name, 'iSi whipper');
assert.deepEqual(waysToMake('Bacon bourbon').map((t) => t.id), ['fat-wash']);
assert.deepEqual(waysToMake('Herb oil').map((t) => t.id), ['infused-oil']);
assert.ok(looksMadeInHouse('Clarified grapefruit'));

// The data is imported only by index.ts's import() and testing.ts (and checks). A static import
// anywhere else copies it into that route's web chunk, or into every page's if enough routes do.
const DATA = /from\s+['"](?:@\/lib\/techniques|\.{1,2}(?:\/[\w.]+)*)\/(?:library|equipment|data\/\w+)['"]/;
const ALLOWED = new Set(['lib/techniques/library.ts', 'lib/techniques/testing.ts']);
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []));
const offenders = ['app', 'components', 'hooks', 'lib', 'store', 'ctx']
  .flatMap((d) => {
    try {
      return walk(d);
    } catch {
      return [];
    }
  })
  .filter((f) => !ALLOWED.has(f) && !/\.(check|test)\.tsx?$/.test(f) && DATA.test(readFileSync(f, 'utf8')));
assert.deepEqual(offenders, [], 'import the technique library through lib/techniques, not its data files');
