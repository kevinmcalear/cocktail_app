// @expo/metro-config's chunk splitting is patched
// (patches/@expo+metro-config+58.0.16.patch). The common chunk every web page
// loads takes what the root layout (or a layout listed in `publicWeb`) and one
// more route use; the shared chunk, linked by app pages only, takes what at
// least 20 app route chunks use; the share pages in `publicWeb` skip it and
// share a public chunk instead (lazy chunks don't count). This fails if an
// upgrade drops the patch.
// Run: npm run test:unit
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// @ts-expect-error internal build file, no types
import { extractCommonChunk } from '@expo/metro-config/build/serializer/chunking/createLegacyChunkingStrategy';

type FakeModule = { path: string };
type FakeChunk = { name?: string; sealed: boolean; isAsync: boolean; entries: Set<FakeModule>; deps: Set<FakeModule> };
type Group = { chunk: FakeChunk; users: Set<FakeChunk>; pages: string[] };

const root = mkdtempSync(join(tmpdir(), 'common-chunk-'));
writeFileSync(join(root, 'package.json'), JSON.stringify({ publicWeb: ['app/(tabs)/_layout.tsx', 'app/d/[id].tsx', 'app/m/[id].tsx'] }));
const mod = (name: string): FakeModule => ({ path: join(root, name) });
const chunk = (entry: FakeModule, ...deps: FakeModule[]): FakeChunk => ({ sealed: false, isAsync: true, entries: new Set([entry]), deps: new Set([entry, ...deps]) });
const graph = { transformOptions: { customTransformOptions: { routerRoot: 'app' } } };
const options = { projectRoot: root };

assert.equal(typeof extractCommonChunk, 'function', 'serializeChunks exports extractCommonChunk: is the patch applied?');

const react = mod('node_modules/react/index.js');
const drinkScreen = mod('components/DrinkScreen.tsx');
const theme = mod('constants/theme.ts');
const tabsBit = mod('components/AppTabs.tsx');
const shareBit = mod('components/ShareHeader.tsx');
const routes = Array.from({ length: 20 }, (_, i) => mod(`app/r${i}.tsx`));
const tabBits = mod('components/TabBits.tsx');
const animation = mod('node_modules/react-native-reanimated/index.js');
const lazyChunks = Array.from({ length: 25 }, (_, i) => chunk(mod(`components/Lazy${i}.tsx`), animation));
const rootLayout = chunk(mod('app/_layout.tsx'), theme);
const tabsLayout = chunk(mod('app/(tabs)/_layout.tsx'), tabsBit);
const drinkPage = chunk(mod('app/d/[id].tsx'), react, drinkScreen, shareBit, tabsBit);
const menuPage = chunk(mod('app/m/[id].tsx'), react, shareBit);
const appRoutes = [
  chunk(routes[0], react, drinkScreen, theme),
  chunk(routes[1], react, drinkScreen),
  ...routes.slice(2).map((r, i) => (i < 17 ? chunk(r, react, tabBits) : chunk(r, react))),
];
const chunks = new Set<FakeChunk>([rootLayout, tabsLayout, drinkPage, menuPage, ...appRoutes, ...lazyChunks]);

const { common, groups } = extractCommonChunk(chunks, graph, options) as { common: FakeChunk; groups: Group[] };
const shared = groups.find((g) => g.chunk.name === '/__shared.js');
const pub = groups.find((g) => g.chunk.name === '/__public.js');
assert.ok(shared && pub, 'a shared chunk for app pages and a public chunk for share pages');

assert.ok(common.deps.has(theme), 'a module the root layout and one route use goes to the common chunk');
assert.ok(common.deps.has(tabsBit) && !drinkPage.deps.has(tabsBit), 'so does one a listed layout and a route use');
assert.ok(shared.chunk.deps.has(react) && appRoutes.every((c) => !c.deps.has(react)), 'a module 20 app routes use goes to the shared chunk and leaves them');
assert.ok(appRoutes.every((c) => shared.users.has(c)), '...and each of those routes loads the shared chunk with itself');
assert.equal(shared.pages.length, 20, 'app pages link the shared chunk; share pages and layouts do not');
assert.ok(!shared.chunk.deps.has(tabBits), 'a module 17 routes use stays with them');
assert.ok(!shared.chunk.deps.has(animation) && lazyChunks.every((c) => c.deps.has(animation)), 'a module only lazy chunks use (25 of them) stays with them');
assert.ok(!shared.chunk.deps.has(drinkScreen) && appRoutes[0].deps.has(drinkScreen) && appRoutes[1].deps.has(drinkScreen), 'a module only 2 app routes use stays with each');
assert.ok(pub.chunk.deps.has(react) && pub.chunk.deps.has(shareBit), 'what two share pages use goes to the public chunk');
assert.ok(!drinkPage.deps.has(react) && !menuPage.deps.has(shareBit) && !shared.users.has(drinkPage), '...and leaves them, which never wait on the shared chunk');
assert.ok(drinkPage.deps.has(drinkScreen), 'a module one share page uses stays with it');
assert.deepEqual(pub.pages.sort(), [drinkPage, menuPage].map((c) => [...c.entries][0].path).sort(), 'share pages link the public chunk');

console.log('commonChunk.check: ok');
