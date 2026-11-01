import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';

import { PrepCard } from './PrepCard';

jest.mock('@/components/ViewAsBanner', () => ({ ViewAsPill: () => null }));
jest.mock('@/hooks/useNearIngredients', () => ({ useNearIngredients: () => [] }));
jest.mock('@/hooks/useKit', () => ({ useKit: () => ({ owned: [], kit: new Set(), toggle: jest.fn() }) }));
jest.mock('@/hooks/useBarKit', () => ({ useMakingKit: () => ({ kit: new Set(), where: 'My Bar', add: jest.fn() }) }));
jest.mock('@/hooks/usePrepCard', () => ({
  ...jest.requireActual('@/hooks/usePrepCard'),
  useCatalogRecipe: () => ({ data: null }),
}));

const page = (name: string) => renderWithProviders(<PrepCard page name={name} venueName={null} drinkName="Pine Old Fashioned" ingredients={[]} onDone={jest.fn()} onLater={jest.fn()} onClose={jest.fn()} />);

// Kevin, 1 Nov (pick 5): the nested page starts on the lines when the name says what it is.
test('a name that says the kind starts on the lines, with what it is as a row to change', async () => {
  await page('Pine syrup');
  expect(screen.getByText('HOUSE-MADE · DRAFT, INSIDE THE DRINK')).toBeTruthy();
  expect(screen.queryByText('WHAT IS IT')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'What it is: Syrup. Change' }));
  expect(screen.getByText('WHAT IS IT')).toBeTruthy();
});

test('a name that says nothing asks what it is first', async () => {
  await page('Grandma’s secret');
  expect(screen.getByText('WHAT IS IT')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^What it is:/ })).toBeNull();
});
