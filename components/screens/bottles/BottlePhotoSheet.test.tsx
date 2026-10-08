import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { renderWithTamagui } from '@/jest.setup';
import type { CatalogItem } from '@/lib/match';

import { BottlePhotoSheet } from './BottlePhotoSheet';

const mockShelfAdd = jest.fn();
const mockShelfRemove = jest.fn();
const catalog: CatalogItem[] = [
  { id: 'gin', name: 'Gin', genericId: null, barId: null },
  { id: 'bee', name: 'Beefeater London Dry Gin', genericId: 'gin', barId: null },
  { id: 'campari', name: 'Campari', genericId: null, barId: null },
  { id: 'cpa', name: 'Carpano Antica Formula Sweet Vermouth', genericId: null, barId: null },
  { id: 'cp-v', name: 'Carpano Vermouth', genericId: null, barId: null },
];

jest.mock('@/hooks/useBulk', () => ({
  useSpecCatalog: () => ({ catalog, aliases: [], methods: [], glasses: [], isLoading: false }),
  useVenueBottle: () => ({ add: { mutateAsync: jest.fn() }, remove: { mutateAsync: jest.fn() } }),
}));
jest.mock('@/hooks/useHomeBar', () => ({
  useShelf: () => ({ data: ['campari'] }),
  useShelfEdit: () => ({ add: { mutateAsync: mockShelfAdd }, remove: { mutateAsync: mockShelfRemove } }),
}));

const readings = [
  { brand: 'Beefeater', name: 'Beefeater London Dry Gin', kind: 'London dry gin', abv: 40 },
  { brand: 'Campari', name: 'Campari', kind: 'Bitter', abv: 25 },
  { brand: 'Carpano', name: 'Carpano Antica Formula', kind: 'Vermouth', abv: null },
];

beforeEach(() => jest.clearAllMocks());

const withQuery = (node: ReactNode) => <QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>;

test('read bottles wait to be checked: sure ones ticked, a pick open, nothing added until Add', async () => {
  await renderWithTamagui(withQuery(<BottlePhotoSheet visible readings={readings} target={{ kind: 'home' }} onClose={jest.fn()} />));
  expect(await screen.findByText('Check the bottles')).toBeTruthy();
  expect(screen.getByText('Will be added · London dry gin · 40%')).toBeTruthy();
  expect(screen.getByText('Already in your shelf · Bitter · 25%')).toBeTruthy();
  expect(screen.getByText('Which one is it? · Vermouth')).toBeTruthy();
  expect(mockShelfAdd).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByRole('radio', { name: 'Carpano Vermouth' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Add 2 to your shelf' }));
  await waitFor(() => expect(mockShelfAdd.mock.calls.map((c) => c[0])).toEqual(['bee', 'cp-v']));
  expect(await screen.findByText('Added to your shelf · London dry gin · 40%')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^Add \d/ })).toBeNull();
});

test('Skip leaves a sure bottle out of Add, and Add brings it back', async () => {
  await renderWithTamagui(withQuery(<BottlePhotoSheet visible readings={readings.slice(0, 1)} target={{ kind: 'home' }} onClose={jest.fn()} />));
  await fireEvent.press(await screen.findByRole('button', { name: 'Skip' }));
  expect(screen.getByText('Skipped · London dry gin · 40%')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^Add \d/ })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
  expect(screen.getByRole('button', { name: 'Add 1 to your shelf' })).toBeTruthy();
  expect(mockShelfAdd).not.toHaveBeenCalled();
});
