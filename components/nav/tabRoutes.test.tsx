import { router, Stack, Tabs } from 'expo-router';
import { act, renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { useStartTabUnder } from '@/components/nav/useStartTabUnder';
import { TABS } from '@/lib/tabs';

// The shell's route shape (app/(tabs)): each tab's first page in its own group,
// and the pages every tab can push in the shared group with its stack.
// Mock screens, so this checks the routing alone.
const SHARED = '(tabs)/(1-tonight,2-drinks,3-discover,4-you)';
function page(name: string) {
  return function Page() {
    return <Text>{name}</Text>;
  };
}

// Tonight's first page; `home` is the start when Tonight is switched off ((1-tonight)/index.tsx).
function tonight(home: string | null) {
  return function Tonight() {
    useStartTabUnder(home);
    return <Text>tonight</Text>;
  };
}

function open(url: string, home: string | null = null) {
  return renderRouter(
    {
      _layout: { unstable_settings: { anchor: '(tabs)' }, default: () => <Stack screenOptions={{ headerShown: false }} /> },
      // As app/(tabs)/_layout.tsx: under a page outside the tabs, the first tab.
      '(tabs)/_layout': {
        unstable_settings: { anchor: TABS[0].route },
        default: () => (
          <Tabs>
            {[...TABS.map((t) => t.route), '(search)'].map((name) => (
              <Tabs.Screen key={name} name={name} />
            ))}
          </Tabs>
        ),
      },
      'add-beer': page('a beer'),
      [`${SHARED}/_layout`]: {
        unstable_settings: { '1-tonight': { anchor: 'index' }, '2-drinks': { anchor: 'drinks' }, '3-discover': { anchor: 'discover' }, '4-you': { anchor: 'you' } },
        default: () => <Stack screenOptions={{ headerShown: false }} />,
      },
      // In the order the app's folder lists them, so a link's tie between groups breaks as it does in the app.
      '(tabs)/(1-tonight)/index': tonight(home),
      [`${SHARED}/cocktail/[id]/index`]: page('drink'),
      [`${SHARED}/beer/[id]/index`]: page('beer'),
      [`${SHARED}/ingredient/[id]/index`]: page('ingredient'),
      [`${SHARED}/prep`]: page('prep'),
      [`${SHARED}/search`]: page('search page'),
      '(tabs)/(2-drinks)/drinks': page('drinks'),
      '(tabs)/(3-discover)/discover': page('discover'),
      '(tabs)/(4-you)/you': page('you'),
      '(tabs)/(search)/_layout': () => <Stack screenOptions={{ headerShown: false }} />,
      '(tabs)/(search)/index': page('search'),
      '(tabs)/(search)/cocktail/[id]/index': page('drink'),
      '(tabs)/(search)/beer/[id]/index': page('beer'),
    },
    { initialUrl: url },
  );
}

it.each(TABS.map((t) => [t.path, t.route]))('opens %s on its own tab', async (path, route) => {
  const r = await open(path);
  expect(r.getSegments().slice(0, 2)).toEqual(['(tabs)', route]);
  expect(r.getPathname()).toBe(path);
});

// A link straight to a drink opens it on one tab's stack (the first tab group the
// app's folder lists; Discover on the web), with that tab's first page under it.
it('opens a drink link on a tab, with its first page under it', async () => {
  const r = await open('/cocktail/1');
  expect(r.getSegments().slice(2)).toEqual(['cocktail', '[id]']);
  await act(async () => router.back());
  expect(TABS.map((t) => t.path)).toContain(r.getPathname());
});

it('pushes a drink on the tab it was opened from, and Back returns there', async () => {
  const r = await open('/drinks');
  await act(async () => router.push('/cocktail/1'));
  expect(r.getSegments()).toEqual(['(tabs)', '(2-drinks)', 'cocktail', '[id]']);
  await act(async () => router.back());
  expect(r.getPathname()).toBe('/drinks');
  await act(async () => router.navigate('/discover'));
  await act(async () => router.push('/prep'));
  expect(r.getSegments()).toEqual(['(tabs)', '(3-discover)', 'prep']);
});

it("switches tabs when a tab's path is opened from another tab", async () => {
  const r = await open('/drinks');
  await act(async () => router.navigate('/discover'));
  expect(r.getSegments()).toEqual(['(tabs)', '(3-discover)', 'discover']);
  await act(async () => router.navigate('/'));
  expect(r.getSegments()).toEqual(['(tabs)', '(1-tonight)']);
});

it('opens a cold link to a drink on Tonight', async () => {
  const r = await open('/cocktail/1');
  expect(r.getSegments()).toEqual(['(tabs)', '(1-tonight)', 'cocktail', '[id]']);
});

// Search (Android and phone web) is a page on the tab it was opened from, so what
// it opens stays on that tab, and Back steps back through the search.
it('pushes search and its results on the tab it was opened from', async () => {
  const r = await open('/drinks');
  await act(async () => router.navigate('/search'));
  expect(r.getSegments()).toEqual(['(tabs)', '(2-drinks)', 'search']);
  await act(async () => router.push('/cocktail/1'));
  expect(r.getSegments()).toEqual(['(tabs)', '(2-drinks)', 'cocktail', '[id]']);
  await act(async () => router.back());
  expect(r.getPathname()).toBe('/search');
  await act(async () => router.back());
  expect(r.getPathname()).toBe('/drinks');
});

it("returns Discover's search to its map", async () => {
  const r = await open('/discover');
  await act(async () => router.navigate('/search'));
  expect(r.getSegments()).toEqual(['(tabs)', '(3-discover)', 'search']);
  await act(async () => router.dismissTo('/discover'));
  expect(r.getSegments()).toEqual(['(tabs)', '(3-discover)', 'discover']);
});

it('pushes a beer and the bottle in it on the same tab, and Back steps through them', async () => {
  const r = await open('/drinks');
  await act(async () => router.push('/beer/1'));
  expect(r.getSegments()).toEqual(['(tabs)', '(2-drinks)', 'beer', '[id]']);
  await act(async () => router.push('/ingredient/2'));
  expect(r.getSegments()).toEqual(['(tabs)', '(2-drinks)', 'ingredient', '[id]']);
  await act(async () => router.back());
  expect(r.getPathname()).toBe('/beer/1');
  await act(async () => router.back());
  expect(r.getPathname()).toBe('/drinks');
});

// iPhone's search tab ((search), a tab of its own): a result opens on that tab's stack,
// so Back returns to the results rather than leaving them behind on another tab.
it("opens a drink from iPhone's search tab on the search tab", async () => {
  const r = await open('/drinks');
  await act(async () => router.navigate('/(tabs)/(search)' as never));
  expect(r.getSegments()).toEqual(['(tabs)', '(search)']);
  await act(async () => router.push('/cocktail/1'));
  expect(r.getSegments()).toEqual(['(tabs)', '(search)', 'cocktail', '[id]']);
  await act(async () => router.back());
  expect(r.getSegments()).toEqual(['(tabs)', '(search)']);
});

// Beer, wine and ingredient pages have the same second address under (search), so their results stay there too.
it("opens a beer from iPhone's search tab on the search tab", async () => {
  const r = await open('/drinks');
  await act(async () => router.navigate('/(tabs)/(search)' as never));
  await act(async () => router.push('/beer/1'));
  expect(r.getSegments()).toEqual(['(tabs)', '(search)', 'beer', '[id]']);
  await act(async () => router.back());
  expect(r.getSegments()).toEqual(['(tabs)', '(search)']);
});

// A link straight to a create wizard: its dialog sits over the tab the app opens on, and its X lands there.
it('opens a cold link to a create wizard over the first tab, and closing it lands there', async () => {
  const r = await open('/add-beer');
  expect(r.getSegments()).toEqual(['add-beer']);
  await act(async () => router.back());
  expect(r.getPathname()).toBe('/');
});

it('with Tonight switched off, the tabs under that wizard move to Drinks and it stays open', async () => {
  const r = await open('/add-beer', '/drinks');
  expect(r.getSegments()).toEqual(['add-beer']);
  await act(async () => router.back());
  expect(r.getPathname()).toBe('/drinks');
});
