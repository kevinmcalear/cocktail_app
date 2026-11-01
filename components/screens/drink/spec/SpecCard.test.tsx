import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { SAMPLE_LEVELS, sampleDrink } from '@/components/ds/gallery/drinkSample';
import { renderWithProviders } from '@/jest.setup';
import { specLines, type PresentationRecipe } from '@/lib/spec';

import { useSpecViewStore } from '@/store/useSpecViewStore';

import { SpecCard } from './SpecCard';

const linesFor = (role: number) => specLines(sampleDrink(role).recipes as PresentationRecipe[] | undefined);
const card = (role: number, maker: boolean) => (
  <QueryClientProvider client={new QueryClient()}>
    <SpecCard itemId="sample-penicillin" barId="sample-venue" lines={linesFor(role)} maker={maker} verb="Shake" serve={['Rocks', 'Large cube']} preview={{ role, levels: SAMPLE_LEVELS }} />
  </QueryClientProvider>
);

test('a bartender opens in Steps, grouped by step, with Makes', async () => {
  await renderWithProviders(card(30, true));
  expect(screen.getByRole('tab', { name: 'Steps' })).toBeSelected();
  expect(screen.getByText('Shake')).toBeTruthy();
  expect(screen.getByText('Float')).toBeTruthy();
  expect(screen.getByText('Makes 1')).toBeTruthy();
  expect(screen.getByText('Rocks · Large cube')).toBeTruthy();
});

test('switching to Ingredients sticks for this person', async () => {
  await renderWithProviders(card(30, true));
  fireEvent.press(screen.getByRole('tab', { name: 'Ingredients' }));
  expect(useSpecViewStore.getState().views['']).toBe('ingredients');
  await waitFor(() => expect(screen.getByRole('tab', { name: 'Ingredients' })).toBeSelected());
  expect(screen.queryByText('Shake')).toBeNull();
});

test('the floor sees names only: no switch, no Makes, no amounts', async () => {
  await renderWithProviders(card(20, false));
  expect(screen.queryByRole('tab', { name: 'Steps' })).toBeNull();
  expect(screen.queryByText('Makes 1')).toBeNull();
  expect(screen.queryByText(/ ml$/)).toBeNull();
  expect(screen.getByText('Blended Scotch')).toBeTruthy();
});
