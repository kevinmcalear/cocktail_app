import { screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { Positions } from './Positions';

const bar = (name: string) => ({ id: name, handle: name.toLowerCase(), display_name: name, avatar_url: null });
const jo = { id: 'jo', handle: 'jo', display_name: 'Jo Juniper', avatar_url: null };
let mockShown = false;
let mockPending = false;
let mockOnlyPast = false;

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/hooks/useProfiles', () => ({
  useProfilePositions: () => ({
    data: [
      ...(mockOnlyPast ? [] : [{ id: '1', title: 'Head bartender', is_current: true, is_shown: false, person_accepted: true, bar_accepted: true, person: jo, bar: bar('Attaboy') }]),
      ...(mockPending ? [{ id: '3', title: 'Barback', is_current: true, is_shown: false, person_accepted: true, bar_accepted: false, person: jo, bar: bar('Dante') }] : []),
      { id: '2', title: 'Bar manager', is_current: false, is_shown: mockShown, person_accepted: true, bar_accepted: true, person: jo, bar: bar('Milk & Honey') },
    ],
  }),
}));

beforeEach(() => {
  mockShown = false;
  mockPending = false;
  mockOnlyPast = false;
});

test('a person shows where they work now, not where they used to', async () => {
  await renderWithTamagui(<Positions profile={{ id: 'jo', kind: 'person' }} />);
  expect(screen.getByText('Attaboy')).toBeTruthy();
  expect(screen.queryByText('Milk & Honey')).toBeNull();
  expect(screen.queryByText('Previously')).toBeNull();
});

test('a shown past job sits under Previously, apart from where they work now', async () => {
  mockShown = true;
  await renderWithTamagui(<Positions profile={{ id: 'jo', kind: 'person' }} />);
  expect(screen.getByText('Works at')).toBeTruthy();
  expect(screen.getByText('Previously')).toBeTruthy();
  expect(screen.getByLabelText('Attaboy, Head bartender. Open their profile')).toBeTruthy();
  expect(screen.getByLabelText('Milk & Honey, formerly Bar manager. Open their profile')).toBeTruthy();
});

test('a bar splits its people into the current team and previous staff', async () => {
  mockShown = true;
  await renderWithTamagui(<Positions profile={{ id: 'attaboy', kind: 'bar' }} emptyText="Nobody yet." />);
  expect(screen.getByText('Current team')).toBeTruthy();
  expect(screen.getByText('Previous')).toBeTruthy();
});

test('a bar with only past staff shows no current team heading', async () => {
  mockShown = true;
  mockOnlyPast = true;
  await renderWithTamagui(<Positions profile={{ id: 'milk', kind: 'bar' }} emptyText="Nobody yet." />);
  expect(screen.queryByText('Current team')).toBeNull();
  expect(screen.getByText('Previous')).toBeTruthy();
});

test('a job that is not confirmed yet is marked pending (only the two sides can read it)', async () => {
  mockPending = true;
  await renderWithTamagui(<Positions profile={{ id: 'jo', kind: 'person' }} />);
  expect(screen.getByText('Barback · Pending: waiting for the bar to confirm')).toBeTruthy();
});
