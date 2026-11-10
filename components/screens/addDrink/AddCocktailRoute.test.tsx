import { act, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import AddCocktailScreen from '@/app/add-cocktail';
import { renderWithProviders } from '@/jest.setup';

// The beer wizard's cold link (Android walk, 9 Nov) has a twin in the drink's: /add-cocktail with no bar opened
// at home at a bar. Now it waits for where you are, then opens there.
let mockParams: Record<string, string> = {};
let mockVenuesLoading = true;
let mockCaps: string[] | undefined = undefined;
let mockCapsIdle = false;
const mockWizard = jest.fn((_props: { barId: string | null }) => null);
const mockDraftEditor = jest.fn((_props: { barId?: string }) => null);

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => true }), useLocalSearchParams: () => mockParams }));
jest.mock('@/components/nav/VenueBrandProvider', () => ({ VenueBrandProvider: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/components/screens/addDrink/AddDrinkWizard', () => ({ AddDrinkWizard: (p: { barId: string | null }) => mockWizard(p) }));
jest.mock('@/components/screens/drink/edit/DraftEditScreen', () => ({ DraftEditScreen: (p: { barId?: string }) => mockDraftEditor(p) }));
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ isLoading: mockVenuesLoading, venues: [], active: null }) }));
jest.mock('@/hooks/useBars', () => ({ useBars: () => ({ fetchStatus: mockVenuesLoading ? 'fetching' : 'idle' }) }));
jest.mock('@/hooks/useMode', () => ({ useHereVenue: () => (mockVenuesLoading ? null : { id: 'bar-1', name: 'Little Rye' }) }));
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: (barId: string | null) => ({ data: barId ? mockCaps : undefined, isError: false, fetchStatus: barId && !mockCaps && !mockCapsIdle ? 'fetching' : 'idle' }) }));

beforeEach(() => {
  mockParams = {};
  mockVenuesLoading = true;
  mockCaps = undefined;
  mockCapsIdle = false;
  mockWizard.mockClear();
  mockDraftEditor.mockClear();
});

test('a cold link with no bar waits for the venue, then opens the drink at the bar', async () => {
  const view = await renderWithProviders(<AddCocktailScreen />);
  expect(mockWizard).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Opening')).toBeTruthy();

  mockVenuesLoading = false;
  mockCaps = ['edit_drinks'];
  await act(() => view.rerender(<AddCocktailScreen />));
  expect(mockWizard).toHaveBeenCalled();
  expect(mockWizard.mock.calls.every(([p]) => p.barId === 'bar-1')).toBe(true);
});

test('a link that says home opens at home at once, even at a venue; so does an old draft’s', async () => {
  mockParams = { barId: 'home' };
  mockVenuesLoading = false;
  mockCaps = ['edit_drinks'];
  await renderWithProviders(<AddCocktailScreen />);
  expect(mockWizard).toHaveBeenLastCalledWith(expect.objectContaining({ barId: null }));

  mockParams = { barId: 'home', draftId: 'd1' };
  await renderWithProviders(<AddCocktailScreen />);
  expect(mockDraftEditor).toHaveBeenLastCalledWith(expect.objectContaining({ barId: undefined }));
});

test('a link that names the bar opens there at once', async () => {
  mockParams = { barId: 'bar-2' };
  await renderWithProviders(<AddCocktailScreen />);
  expect(mockWizard).toHaveBeenLastCalledWith(expect.objectContaining({ barId: 'bar-2' }));
});

test('rights that are never asked for (no user yet) don’t hold the page: it opens at home', async () => {
  mockVenuesLoading = false;
  mockCapsIdle = true;
  await renderWithProviders(<AddCocktailScreen />);
  expect(mockWizard).toHaveBeenLastCalledWith(expect.objectContaining({ barId: null }));
});
