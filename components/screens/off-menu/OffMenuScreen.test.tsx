import { fireEvent, screen } from '@testing-library/react-native';

import { OffMenuScreen } from '@/components/screens/off-menu/OffMenuScreen';
import { renderWithTamagui } from '@/jest.setup';

const mockMutate = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: jest.fn(), back: jest.fn(), canGoBack: () => false }) }));
jest.mock('@/hooks/useMode', () => ({ useMode: () => ({ mode: 'venue' }) }));
jest.mock('@/hooks/useIsWideWeb', () => ({ useIsWideWeb: () => true }));
jest.mock('@/hooks/useActiveVenue', () => ({
  useActiveVenue: () => ({ active: { id: 'bar', name: 'Caretakers' }, isLoading: false }),
}));
jest.mock('@/hooks/useCapabilities', () => ({
  useCapabilities: () => ({ data: ['menus'] }),
  useCapabilityOpensAt: () => ({ data: 35 }),
}));
jest.mock('@/hooks/useDiscover', () => ({
  useDrinkLists: () => ({ data: [{ id: 'catalog-daiquiri', name: 'Daiquiri' }] }),
}));
jest.mock('@/hooks/useOffMenu', () => ({
  useOffMenu: () => ({
    data: [
      { itemId: 'martini', rank: 1, name: 'Martini', classicName: 'Martini' },
      { itemId: 'daiquiri', rank: null, name: 'House Daiquiri', classicName: 'Daiquiri' },
    ],
    isLoading: false,
    error: null,
  }),
  useBarRiffs: () => ({ data: [{ id: 'daiquiri', name: 'House Daiquiri', classicName: 'Daiquiri' }] }),
  useOffMenuEdit: () => ({ mutate: mockMutate, isPending: false, error: null }),
}));

beforeEach(() => mockMutate.mockClear());

test('ranks an off-menu classic into the next free top-10 slot', async () => {
  await renderWithTamagui(<OffMenuScreen />);
  expect(screen.getByText('Recommend these first')).toBeTruthy();
  expect(screen.getByText('House Daiquiri')).toBeTruthy();

  const top10 = screen.getAllByRole('radio', { name: 'Top 10' });
  await fireEvent.press(top10[top10.length - 1]);
  expect(mockMutate).toHaveBeenCalledWith({ op: 'rank', itemId: 'daiquiri', rank: 2 });
});
