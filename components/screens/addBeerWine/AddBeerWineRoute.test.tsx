import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { renderWithProviders } from '@/jest.setup';
import { useBeerWineWizardStore } from '@/store/useBeerWineWizardStore';

import { AddBeerWineRoute } from './AddBeerWineRoute';

// Android walk, 9 Nov: a cold link to /add-beer at a bar opened the home wizard (1 of 6, no price) because the link
// names no bar and the venue wasn't known yet. Now it waits for where you are, then opens there.
let mockParams: Record<string, string> = {};
let mockVenuesLoading = true;
let mockCaps: string[] | undefined = undefined;
let mockBarsPaused = false;
const mockDraftScreen = jest.fn((_props: { barId: string | null }) => null);

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => true }), useLocalSearchParams: () => mockParams }));
jest.mock('@react-native-community/netinfo', () => ({ useNetInfo: () => ({ isConnected: true }) }));
jest.mock('@/lib/toast', () => ({ toastDone: jest.fn() }));
jest.mock('@/components/nav/VenueBrandProvider', () => ({ VenueBrandProvider: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/components/screens/drink/edit/BeerWineEditScreen', () => ({ BeerWineDraftEditScreen: (p: { barId: string | null }) => mockDraftScreen(p) }));
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ isLoading: mockVenuesLoading, venues: [], active: null }) }));
jest.mock('@/hooks/useBars', () => ({ useBars: () => ({ fetchStatus: mockBarsPaused ? 'paused' : mockVenuesLoading ? 'fetching' : 'idle' }) }));
jest.mock('@/hooks/useMode', () => ({ useHereVenue: () => (mockVenuesLoading ? null : { id: 'bar-1', name: 'Little Rye' }) }));
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: (barId: string | null) => ({ data: barId ? mockCaps : undefined, isError: false, fetchStatus: barId && !mockCaps ? 'fetching' : 'idle' }) }));
jest.mock('@/hooks/useCreateBeerWine', () => ({
  useCreateBeerWine: () => ({ mutate: jest.fn(), isPending: false }),
  useBeerWineWaiting: () => false,
  useCatalogBottles: () => ({ data: [] }),
}));
jest.mock('@/hooks/useSameNameDrink', () => ({ useSameNameDrink: () => ({ data: null, checking: false }) }));
jest.mock('@/hooks/useReadLabel', () => ({ useReadLabel: () => ({ mutate: jest.fn(), isPending: false }) }));
jest.mock('@/components/ds/SketchDrawing', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SketchDrawing: () => <View testID="drawing" /> };
});

beforeEach(() => {
  mockParams = {};
  mockVenuesLoading = true;
  mockCaps = undefined;
  mockBarsPaused = false;
  mockDraftScreen.mockClear();
  useBeerWineWizardStore.setState({ kept: {} });
});

const laidOut = () => fireEvent(screen.getByTestId('add-beer'), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });

test('a cold link with no bar waits for the venue, then opens as the bar’s beer, with its price step', async () => {
  const view = await renderWithProviders(<AddBeerWineRoute kind="beer" />);
  // The venues, the mode and your rights there aren't known yet: no wizard, so no step count to jump.
  expect(screen.queryByText('What’s the beer?')).toBeNull();
  expect(screen.getByLabelText('Opening')).toBeTruthy();

  // The venue arrives, then what you can do there.
  mockVenuesLoading = false;
  await act(() => view.rerender(<AddBeerWineRoute kind="beer" />));
  expect(screen.queryByText('What’s the beer?')).toBeNull();
  mockCaps = ['edit_drinks'];
  await act(() => view.rerender(<AddBeerWineRoute kind="beer" />));
  await laidOut();
  expect(screen.getByText('What’s the beer?')).toBeTruthy();
  expect(screen.getByText('BEER · 1 OF 7')).toBeTruthy();
});

test('at a venue where you can’t add, it opens in your home bar, as Add says, and stays there', async () => {
  mockVenuesLoading = false;
  mockCaps = [];
  const view = await renderWithProviders(<AddBeerWineRoute kind="beer" />);
  await laidOut();
  expect(screen.getByText('BEER · 1 OF 6')).toBeTruthy();
  // Rights that arrive later (a slow or offline read) never move an open wizard.
  mockCaps = ['edit_drinks'];
  await act(() => view.rerender(<AddBeerWineRoute kind="beer" />));
  expect(screen.getByText('BEER · 1 OF 6')).toBeTruthy();
});

test('offline with no venues saved, it opens at home rather than wait for signal', async () => {
  mockBarsPaused = true;
  await renderWithProviders(<AddBeerWineRoute kind="beer" />);
  await laidOut();
  expect(screen.getByText('BEER · 1 OF 6')).toBeTruthy();
});

test('a link that says home opens at home, even at a venue', async () => {
  mockParams = { barId: 'home' };
  mockVenuesLoading = false;
  mockCaps = ['edit_drinks'];
  await renderWithProviders(<AddBeerWineRoute kind="beer" />);
  await laidOut();
  expect(screen.getByText('BEER · 1 OF 6')).toBeTruthy();
});

test('a link that names the bar opens at once; a home draft’s link stays at home', async () => {
  mockParams = { barId: 'bar-2' };
  await renderWithProviders(<AddBeerWineRoute kind="beer" />);
  await laidOut();
  expect(screen.getByText('BEER · 1 OF 7')).toBeTruthy();

  mockParams = { draftId: 'd1' };
  mockVenuesLoading = false;
  mockCaps = ['edit_drinks'];
  await renderWithProviders(<AddBeerWineRoute kind="beer" />);
  expect(mockDraftScreen).toHaveBeenLastCalledWith(expect.objectContaining({ barId: null }));
});
