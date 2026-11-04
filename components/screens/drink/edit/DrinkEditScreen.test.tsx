import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';

import { DrinkEditScreen } from './DrinkEditScreen';

const mockEditor = jest.fn();
jest.mock('@/hooks/useCocktailEditor', () => ({ useCocktailEditor: (...a: unknown[]) => mockEditor(...a) }));
jest.mock('@/hooks/useCocktails', () => ({ ...jest.requireActual('@/hooks/useCocktails'), useCocktail: () => ({ data: undefined }) }));
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ venues: [] }) }));

describe('DrinkEditScreen', () => {
  test('a cold load shows the page loading, not an empty New drink form', async () => {
    mockEditor.mockReturnValue({ loading: true });
    await renderWithProviders(<DrinkEditScreen id="abc" onExit={jest.fn()} />);
    expect(screen.getByLabelText('Loading the drink')).toBeTruthy();
    expect(screen.queryByLabelText('Drink name')).toBeNull();
  });

  test('before the route has its id, it waits too', async () => {
    mockEditor.mockReturnValue({ loading: false });
    await renderWithProviders(<DrinkEditScreen id={undefined as unknown as string} onExit={jest.fn()} />);
    expect(screen.getByLabelText('Loading the drink')).toBeTruthy();
  });
});
