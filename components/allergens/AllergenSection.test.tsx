import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';

import { AllergenSection } from './AllergenSection';

const roleAt = { role: 40, previewing: false };

jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ active: { id: 'bar-1', name: 'Little Rye' } }) }));
jest.mock('@/hooks/useMode', () => ({ useMode: () => ({ mode: 'venue' }) }));
// The server's capabilities are the person's own: View as never changes them.
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ data: ['edit_drinks'] }) }));
jest.mock('@/hooks/useViewAs', () => ({ useRoleAt: () => roleAt }));
jest.mock('@/hooks/useAllergens', () => ({
  useItemAllergens: () => ({ data: { bar: null, catalogue: null }, isPending: false }),
  useSetItemAllergens: () => ({ mutate: jest.fn(), isPending: false, error: null }),
  useDrinkAllergens: () => ({ data: null, isPending: false }),
}));

test('an Admin can tick what is in it', async () => {
  Object.assign(roleAt, { role: 40, previewing: false });
  await renderWithProviders(<AllergenSection itemId="i" houseMade={false} canEditItem />);
  expect(screen.getByText(/^Tick what's on the label/)).toBeTruthy();
});

test('viewing as Employee reads it, as an Employee would (iOS round 12)', async () => {
  Object.assign(roleAt, { role: 20, previewing: true });
  await renderWithProviders(<AllergenSection itemId="i" houseMade={false} canEditItem={false} />);
  expect(screen.queryByText(/^Tick what's on the label/)).toBeNull();
  expect(screen.getByText('Nobody has checked this ingredient yet.')).toBeTruthy();
});
