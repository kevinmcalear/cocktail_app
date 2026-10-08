import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { DiscoverBar, DiscoverDrink } from '@/lib/discoverDrinks';
import type { Area } from '@/lib/nearMe';

import { DiscoverMapPane } from './DiscoverMapPane';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/hooks/useDiscover', () => ({
  useDebounced: (v: unknown) => v,
  useDiscoverRankings: () => ({ data: undefined, isLoading: false }),
  useTopBars: () => ({ data: undefined, isLoading: false }),
}));
let mockTopDrinks: unknown[] = [];
jest.mock('@/hooks/useRankings', () => ({ useBarTopDrinks: () => ({ data: mockTopDrinks }) }));
jest.mock('./DiscoverMap', () => {
  const { Pressable } = require('react-native');
  return {
    mapAvailable: true,
    DiscoverMap: ({ pins, onSelect }: { pins: { id: string; name: string }[]; onSelect: (id: string) => void }) => (
      <>
        {pins.map((p) => (
          <Pressable key={p.id} role="button" accessibilityLabel={`pin ${p.name}`} onPress={() => onSelect(p.id)} />
        ))}
      </>
    ),
  };
});

const area: Area = { kind: 'anywhere' };
const bar: DiscoverBar = {
  id: 'b1',
  handle: 'caretakers',
  name: "Caretaker's Cottage",
  logo: null,
  locality: 'Melbourne CBD',
  city: 'Melbourne',
  countryCode: 'AU',
  latitude: -37.81,
  longitude: 144.96,
  closed: false,
  closedYear: null,
};

function drink(id: string, name: string): DiscoverDrink {
  return { id, name, description: `${name} note`, imageUrl: null, barId: bar.id, ingredients: [], styles: [], spirits: [], haystack: '' };
}

function renderPane(drinks: DiscoverDrink[]) {
  return renderWithTamagui(
    <DiscoverMapPane
      mode="side"
      area={area}
      onArea={() => {}}
      drink={null}
      results={{ drinks, barsById: new Map([[bar.id, bar]]), isLoading: false, title: 'Martinis anywhere' }}
    />
  );
}

test('a drinks pin lists those cocktails in the card', async () => {
  const drinks = [drink('d1', 'House Martini'), drink('d2', 'Bamboo'), drink('d3', 'Vesper'), drink('d4', 'Martini No. 4')];
  await renderPane(drinks);

  expect(screen.queryByText('House Martini')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: "pin Caretaker's Cottage" }));

  expect(screen.getByText('House Martini')).toBeTruthy();
  expect(screen.getByText('Bamboo')).toBeTruthy();
  expect(screen.getByText('Vesper')).toBeTruthy();
  expect(screen.queryByText('Martini No. 4')).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'Show all 4' }));
  expect(screen.getByText('Martini No. 4')).toBeTruthy();
});

test("the card shows the bar's top drinks once they have scores", async () => {
  const top = (item_id: string, name: string, position: number | null, score: number | null) => ({
    position, item_id, name, bar_id: null, ranked_as_item_id: item_id, ranked_as_name: null, image_url: null, image_is_generated: null,
    score, rankers: score === null ? 3 : 30, menu: null, menu_from: null, menu_to: null,
  });
  mockTopDrinks = [top('t1', 'Smoke & Fig Old Fashioned', 1, 9.4), top('t2', 'Rye Garden Highball', 2, 9), top('t3', 'Early Bird', null, null)];
  await renderPane([drink('d1', 'House Martini')]);
  await fireEvent.press(screen.getByRole('button', { name: "pin Caretaker's Cottage" }));

  expect(screen.getByText('Top drinks here')).toBeTruthy();
  expect(screen.getByText('Smoke & Fig Old Fashioned')).toBeTruthy();
  expect(screen.getByText('9.4')).toBeTruthy();
  expect(screen.getByText('9.0')).toBeTruthy();
  expect(screen.queryByText('Early Bird')).toBeNull();
});

test('an early bar\'s card has no top drinks block', async () => {
  mockTopDrinks = [];
  await renderPane([drink('d1', 'House Martini')]);
  await fireEvent.press(screen.getByRole('button', { name: "pin Caretaker's Cottage" }));
  expect(screen.queryByText('Top drinks here')).toBeNull();
});
