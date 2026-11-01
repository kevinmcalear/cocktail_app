import { router, Stack, Tabs } from 'expo-router';
import { act, renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

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

function open(url: string) {
  return renderRouter(
    {
      _layout: () => <Stack screenOptions={{ headerShown: false }} />,
      '(tabs)/_layout': () => (
        <Tabs>
          {[...TABS.map((t) => t.route), 'search'].map((name) => (
            <Tabs.Screen key={name} name={name} />
          ))}
        </Tabs>
      ),
      [`${SHARED}/_layout`]: {
        unstable_settings: { '1-tonight': { anchor: 'index' }, '2-drinks': { anchor: 'drinks' }, '3-discover': { anchor: 'discover' }, '4-you': { anchor: 'you' } },
        default: () => <Stack screenOptions={{ headerShown: false }} />,
      },
      // In the order the app's folder lists them, so a link's tie between groups breaks as it does in the app.
      '(tabs)/(1-tonight)/index': page('tonight'),
      [`${SHARED}/cocktail/[id]/index`]: page('drink'),
      [`${SHARED}/prep`]: page('prep'),
      '(tabs)/(2-drinks)/drinks': page('drinks'),
      '(tabs)/(3-discover)/discover': page('discover'),
      '(tabs)/(4-you)/you': page('you'),
      '(tabs)/search/index': page('search'),
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
