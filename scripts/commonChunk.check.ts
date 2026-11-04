// @expo/metro-config's chunk splitting is patched
// (patches/@expo+metro-config+58.0.16.patch): the common chunk every web page
// loads takes a module only when the root layout or at least 20 route chunks
// use it (lazy chunks don't count), or two routes use a module on its
// ALWAYS_COMMON list (the technique data); and a lazy chunk drops the modules every chunk
// that imports it already has. This fails if an upgrade drops the patch.
// Run: npm run test:unit
import assert from 'node:assert/strict';

// @ts-expect-error internal build file, no types
import { dropParentCopies, extractCommonChunk } from '@expo/metro-config/build/serializer/chunking/createLegacyChunkingStrategy';

type FakeModule = { path: string };
type FakeChunk = { sealed: boolean; isAsync: boolean; entries: Set<FakeModule>; deps: Set<FakeModule> };

const mod = (name: string): FakeModule => ({ path: `/p/${name}` });
const chunk = (entry: FakeModule, ...deps: FakeModule[]): FakeChunk => ({ sealed: false, isAsync: true, entries: new Set([entry]), deps: new Set([entry, ...deps]) });
const graph = { transformOptions: { customTransformOptions: { routerRoot: 'app' } } };
const options = { projectRoot: '/p' };

assert.equal(typeof extractCommonChunk, 'function', 'serializeChunks exports extractCommonChunk: is the patch applied?');

const react = mod('node_modules/react/index.js');
const drinkScreen = mod('components/DrinkScreen.tsx');
const theme = mod('constants/theme.ts');
const routes = Array.from({ length: 20 }, (_, i) => mod(`app/r${i}.tsx`));
const tabBits = mod('components/TabBits.tsx');
const techniqueData = mod('lib/techniques/data/foam.ts');
const animation = mod('node_modules/react-native-reanimated/index.js');
const lazyChunks = Array.from({ length: 25 }, (_, i) => chunk(mod(`components/Lazy${i}.tsx`), animation));
const rootLayout = chunk(mod('app/_layout.tsx'), theme);
const chunks = new Set<FakeChunk>([
  rootLayout,
  chunk(routes[0], react, drinkScreen, theme),
  chunk(routes[1], react, drinkScreen),
  ...routes.slice(2).map((r, i) => (i < 17 ? chunk(r, react, tabBits, techniqueData) : chunk(r, react))),
  ...lazyChunks,
]);

const common = extractCommonChunk(chunks, graph, options) as FakeChunk;
const routeChunks = [...chunks].filter((c) => c !== rootLayout && !lazyChunks.includes(c));
assert.ok(common.deps.has(react), 'a module 20 routes use goes to the common chunk');
assert.ok(!common.deps.has(tabBits), 'a module 17 routes use stays with them');
assert.ok(!common.deps.has(animation) && lazyChunks.every((c) => c.deps.has(animation)), 'a module only lazy chunks use (25 of them) stays with them');
assert.ok(common.deps.has(techniqueData), 'a listed module (the technique data) goes to the common chunk with fewer than 20 routes');
assert.ok(common.deps.has(theme), 'a module the root layout and one route use goes to the common chunk');
assert.ok(!common.deps.has(drinkScreen), 'a module only 2 routes use stays out of it');
assert.ok(routeChunks[0].deps.has(drinkScreen) && routeChunks[1].deps.has(drinkScreen), '...and each of those routes keeps a copy');
assert.ok(routeChunks.every((c) => !c.deps.has(react)), 'a module in the common chunk leaves the route chunks');

// A lazy chunk drops what every chunk that imports it already has; routes and shared entries stay.
type Dep = { data: { data: { asyncType: string } }; absolutePath: string };
type Mod = FakeModule & { dependencies: Map<string, Dep> };
const withImports = (name: string, ...targets: FakeModule[]): Mod => ({
  ...mod(name),
  dependencies: new Map(targets.map((t) => [t.path, { data: { data: { asyncType: 'async' } }, absolutePath: t.path }])),
});
const lazyEntry = mod('components/Sheet.tsx');
const lazyEntryB = mod('components/Map.tsx');
const owner = withImports('app/owner.tsx', lazyEntry, lazyEntryB);
const other = withImports('app/other.tsx', lazyEntryB);
const shared = mod('components/shared.tsx');
const sheet: FakeChunk = { sealed: false, isAsync: true, entries: new Set([lazyEntry]), deps: new Set([lazyEntry, shared, drinkScreen]) };
const map: FakeChunk = { sealed: false, isAsync: true, entries: new Set([lazyEntryB]), deps: new Set([lazyEntryB, shared, drinkScreen]) };
const ownerChunk: FakeChunk = { sealed: false, isAsync: true, entries: new Set([owner]), deps: new Set([owner, shared, drinkScreen]) };
const otherChunk: FakeChunk = { sealed: false, isAsync: true, entries: new Set([other]), deps: new Set([other, shared]) };
dropParentCopies(new Set([ownerChunk, otherChunk, sheet, map]), graph, options);
assert.ok(!sheet.deps.has(shared) && !sheet.deps.has(drinkScreen) && sheet.deps.has(lazyEntry), 'a lazy chunk drops what its only importer has, and keeps its own entry');
assert.ok(map.deps.has(shared) === false && map.deps.has(drinkScreen), 'a module one of its importers lacks stays in the lazy chunk');
assert.ok(ownerChunk.deps.has(shared) && ownerChunk.deps.has(drinkScreen), 'a route keeps its copies');

console.log('commonChunk.check: ok');
