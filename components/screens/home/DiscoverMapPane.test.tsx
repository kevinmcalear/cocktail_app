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
      kind={null}
      onKind={() => {}}
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
