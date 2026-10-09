import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { CreateSheet } from './CreateSheet';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/hooks/useDrafts', () => ({ useDrafts: () => ({ drafts: [] }) }));
let mockMine = { venueId: null as string | null, canAdd: true };
jest.mock('@/hooks/useSearchMine', () => ({ useSearchMine: () => mockMine }));

async function open(label: string) {
  await renderWithTamagui(<CreateSheet visible onClose={jest.fn()} />);
  await fireEvent.press(screen.getByRole('link', { name: new RegExp(`^${label}\\.`) }));
  return mockPush.mock.calls.at(-1)?.[0];
}

beforeEach(() => mockPush.mockReset());

// At a venue, New > Drink saved to your home bar.
test('at a venue, what you make is the venue’s', async () => {
  mockMine = { venueId: 'bar', canAdd: true };
  expect(await open('Drink')).toBe('/add-cocktail?barId=bar');
  expect(await open('Wine')).toBe('/add-wine?barId=bar');
  expect(await open('Menu')).toBe('/menus/all?new=1');
});

test('at home, it is yours', async () => {
  mockMine = { venueId: null, canAdd: true };
  expect(await open('Ingredient')).toBe('/add-ingredient');
});

test('without the right to add at the venue, only menus, bring in and drafts', async () => {
  mockMine = { venueId: 'bar', canAdd: false };
  await renderWithTamagui(<CreateSheet visible onClose={jest.fn()} />);
  expect(screen.queryByRole('link', { name: /^Drink\./ })).toBeNull();
  expect(screen.getByRole('link', { name: /^Menu\./ })).toBeTruthy();
  expect(screen.getByRole('link', { name: /^Bring in\./ })).toBeTruthy();
});
