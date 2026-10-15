import { fireEvent, screen } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderWithTamagui } from '@/jest.setup';
import type { SavedPlace } from '@/lib/googleTakeout';

import { GoogleImportSheet } from './GoogleImport';

const mockFile = { current: null as { name: string; text: string } | null };
jest.mock('@/lib/pickTakeoutFile', () => ({ canPickFiles: true, TOO_BIG: 'too big', pickTakeoutFile: () => Promise.resolve(mockFile.current) }));

const bar = (id: string, display_name: string, latitude: number | null, longitude: number | null, locality: string) => ({ id, display_name, latitude, longitude, locality, city: 'Melbourne', avatar_url: null });
const mockBars = [bar('margaux', 'Bar Margaux', -37.81051, 144.96914, 'Melbourne CBD'), bar('olo', 'Bar Olo', -37.79634, 144.97488, 'Carlton'), bar('pearl', 'Black Pearl', -37.79807, 144.97875, 'Fitzroy')];
// The match runs on the device against every bar: here, three of them.
jest.mock('@/hooks/useGoogleImport', () => {
  const { useState } = jest.requireActual('react');
  const { matchPlaces } = jest.requireActual('@/lib/googleTakeout');
  return {
    useMatchSavedPlaces: () => {
      const [data, setData] = useState(undefined);
      return {
        data,
        isPending: false,
        isError: false,
        reset: () => setData(undefined),
        mutate: (places: SavedPlace[], opts: { onSuccess: (r: unknown) => void }) => {
          const r = matchPlaces(places, mockBars);
          setData(r);
          opts.onSuccess(r);
        },
      };
    },
  };
});
let mockLoved: { id: string }[] = [];
const mockLove = jest.fn((_vars: unknown, opts: { onSuccess: () => void }) => opts.onSuccess());
jest.mock('@/hooks/useKept', () => ({ useLovedBars: () => ({ data: mockLoved }), useLoveBar: () => ({ mutate: mockLove, reset: jest.fn(), isPending: false, isError: false }) }));
let mockHidden: { id: string }[] = [];
jest.mock('@/hooks/useHiddenBars', () => ({ useHiddenBars: () => ({ data: mockHidden }) }));
jest.mock('@/components/screens/safety/AgeGate', () => ({ useAgeGate: () => ({ gate: (run: () => void) => run(), sheet: null }) }));
jest.mock('@/components/screens/home/BarMark', () => ({ BarMark: () => null }));
const mockToast = jest.fn();
jest.mock('@/lib/toast', () => ({ toastDone: (title: string) => mockToast(title) }));

const sample = readFileSync(join(__dirname, '../../../lib/fixtures/google-takeout/Saved Places.json'), 'utf8');

beforeEach(() => {
  jest.clearAllMocks();
  mockLoved = [];
  mockHidden = [];
  mockFile.current = { name: 'Saved Places.json', text: sample };
});

test('reads the file, ticks the sure matches, and loves the ticked bars in one go', async () => {
  const onClose = jest.fn();
  await renderWithTamagui(<GoogleImportSheet visible onClose={onClose} />);
  expect(screen.getByRole('button', { name: 'Love 0 bars' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Choose the file' }));
  expect(await screen.findByText('3 of 6 places are bars we know')).toBeTruthy();
  // Same name within 150 m is ticked; Bar Olo, saved about 400 m away, waits for a tick.
  expect(screen.getByRole('checkbox', { name: 'Love Bar Margaux. Melbourne CBD, Melbourne' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Love Black Pearl. Fitzroy, Melbourne · saved as “The Black Pearl Bar”' })).toBeChecked();
  const olo = screen.getByRole('checkbox', { name: 'Love Bar Olo. Carlton, Melbourne' });
  expect(olo).not.toBeChecked();
  await fireEvent.press(olo);
  await fireEvent.press(screen.getByRole('button', { name: 'Love 3 bars' }));
  expect(mockLove).toHaveBeenCalledWith({ profileId: ['margaux', 'pearl', 'olo'], love: true }, expect.anything());
  expect(mockToast).toHaveBeenCalledWith('Loved 3 bars');
  expect(onClose).toHaveBeenCalled();
});

test('bars already loved are left out and counted', async () => {
  mockLoved = [{ id: 'margaux' }];
  await renderWithTamagui(<GoogleImportSheet visible onClose={jest.fn()} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Choose the file' }));
  expect(await screen.findByText('3 of 6 places are bars we know · 1 you already love')).toBeTruthy();
  expect(screen.queryByRole('checkbox', { name: /Bar Margaux/ })).toBeNull();
  expect(screen.getByRole('button', { name: 'Love 1 bar' })).toBeTruthy();
});

test('a bar they hid is not offered', async () => {
  mockHidden = [{ id: 'olo' }];
  await renderWithTamagui(<GoogleImportSheet visible onClose={jest.fn()} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Choose the file' }));
  expect(await screen.findByRole('button', { name: 'Love 2 bars' })).toBeTruthy();
  expect(screen.queryByRole('checkbox', { name: /Bar Olo/ })).toBeNull();
});

test('a file that is not from Google Maps says so and saves nothing', async () => {
  mockFile.current = { name: 'notes.csv', text: 'Name,Amount\nGin,30' };
  await renderWithTamagui(<GoogleImportSheet visible onClose={jest.fn()} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Choose the file' }));
  expect(await screen.findByText(/That isn’t a Google Maps file/)).toBeTruthy();
  expect(mockLove).not.toHaveBeenCalled();
});
