// @expo/metro-config's chunk splitting is patched
// (patches/@expo+metro-config+58.0.7.patch): the common chunk every web page
// loads takes a module only when the root layout or at least 5 async chunks
// use it. This fails if an upgrade drops the patch.
// Run: npm run test:unit
import assert from 'node:assert/strict';

// @ts-expect-error internal build file, no types
import { extractCommonChunk } from '@expo/metro-config/build/serializer/serializeChunks';

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
const routes = ['a', 'b', 'c', 'd', 'e'].map((r) => mod(`app/${r}.tsx`));
const rootLayout = chunk(mod('app/_layout.tsx'), theme);
const chunks = new Set<FakeChunk>([
  rootLayout,
  chunk(routes[0], react, drinkScreen, theme),
  chunk(routes[1], react, drinkScreen),
  ...routes.slice(2).map((r) => chunk(r, react)),
]);

const common = extractCommonChunk(chunks, graph, options) as FakeChunk;
const routeChunks = [...chunks].filter((c) => c !== rootLayout);
assert.ok(common.deps.has(react), 'a module 5 routes use goes to the common chunk');
assert.ok(common.deps.has(theme), 'a module the root layout and one route use goes to the common chunk');
assert.ok(!common.deps.has(drinkScreen), 'a module only 2 routes use stays out of it');
assert.ok(routeChunks[0].deps.has(drinkScreen) && routeChunks[1].deps.has(drinkScreen), '...and each of those routes keeps a copy');
assert.ok(routeChunks.every((c) => !c.deps.has(react)), 'a module in the common chunk leaves the route chunks');

console.log('commonChunk.check: ok');
