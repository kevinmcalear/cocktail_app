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
      ...(mockOnlyPast ? [] : [{ id: '1', title: 'Head bartender', is_current: true, is_shown: false, start_year: 2023, end_year: null, person_accepted: true, bar_accepted: true, person: jo, bar: bar('Attaboy') }]),
      ...(mockPending ? [{ id: '3', title: 'Barback', is_current: true, is_shown: false, person_accepted: true, bar_accepted: false, person: jo, bar: bar('Dante') }] : []),
      { id: '2', title: 'Bar manager', is_current: false, is_shown: mockShown, start_year: 2019, end_year: 2023, person_accepted: true, bar_accepted: true, person: jo, bar: bar('Milk & Honey') },
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
  expect(screen.getByText('Attaboy · 2023 to now')).toBeTruthy();
  expect(screen.queryByText(/Milk & Honey/)).toBeNull();
  expect(screen.queryByText('Previously')).toBeNull();
});

test('a shown past job sits under Previously, apart from where they work now', async () => {
  mockShown = true;
  await renderWithTamagui(<Positions profile={{ id: 'jo', kind: 'person' }} />);
  expect(screen.getByText('Works at')).toBeTruthy();
  expect(screen.getByText('Previously')).toBeTruthy();
  // The title first, the bar and its years, then who confirmed it (ppl-person).
  expect(screen.getByLabelText("Head bartender, Attaboy · 2023 to now. Confirmed by Attaboy. Open the bar's profile")).toBeTruthy();
  expect(screen.getByLabelText("Bar manager, Milk & Honey · 2019 to 2023. Confirmed by Milk & Honey. Open the bar's profile")).toBeTruthy();
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
  expect(screen.getByText('Barback')).toBeTruthy();
  expect(screen.getByText('Not confirmed by the bar yet')).toBeTruthy();
});
