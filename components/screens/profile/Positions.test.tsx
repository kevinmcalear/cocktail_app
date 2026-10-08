import { screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { Positions } from './Positions';

const bar = (name: string) => ({ id: name, handle: name.toLowerCase(), display_name: name, avatar_url: null });
const jo = { id: 'jo', handle: 'jo', display_name: 'Jo Juniper', avatar_url: null };
let mockShown = false;
let mockPending = false;

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/hooks/useProfiles', () => ({
  useProfilePositions: () => ({
    data: [
      { id: '1', title: 'Head bartender', is_current: true, is_shown: false, person_accepted: true, bar_accepted: true, person: jo, bar: bar('Attaboy') },
      ...(mockPending ? [{ id: '3', title: 'Barback', is_current: true, is_shown: false, person_accepted: true, bar_accepted: false, person: jo, bar: bar('Dante') }] : []),
      { id: '2', title: 'Bar manager', is_current: false, is_shown: mockShown, person_accepted: true, bar_accepted: true, person: jo, bar: bar('Milk & Honey') },
    ],
  }),
}));

beforeEach(() => {
  mockShown = false;
  mockPending = false;
});

test('a person shows where they work now, not where they used to', async () => {
  await renderWithTamagui(<Positions profile={{ id: 'jo', kind: 'person' }} />);
  expect(screen.getByText('Attaboy')).toBeTruthy();
  expect(screen.queryByText('Milk & Honey')).toBeNull();
  expect(screen.queryByText(/Formerly/)).toBeNull();
});

test('a past job shows, marked former, once the person switches it on', async () => {
  mockShown = true;
  await renderWithTamagui(<Positions profile={{ id: 'jo', kind: 'person' }} />);
  expect(screen.getByText('Attaboy')).toBeTruthy();
  expect(screen.getByText('Milk & Honey')).toBeTruthy();
  expect(screen.getByText('Formerly bar manager')).toBeTruthy();
});

test('a job that is not confirmed yet is marked pending (only the two sides can read it)', async () => {
  mockPending = true;
  await renderWithTamagui(<Positions profile={{ id: 'jo', kind: 'person' }} />);
  expect(screen.getByText('Barback · Pending: waiting for the bar to confirm')).toBeTruthy();
});
