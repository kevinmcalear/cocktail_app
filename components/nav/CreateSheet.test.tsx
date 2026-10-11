import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { CreateSheet } from './CreateSheet';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/hooks/useDrafts', () => ({ useDrafts: () => ({ drafts: [] }) }));
const mockSetMode = jest.fn();
jest.mock('@/hooks/useMode', () => ({ useMode: () => ({ mode: 'venue', setMode: mockSetMode }) }));
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ data: [] }), useCapabilityOpensAt: () => ({ data: 35 }) }));
let mockMine = { venueId: null as string | null, canAdd: true, label: 'Your drinks' };
jest.mock('@/hooks/useSearchMine', () => ({ useSearchMine: () => mockMine }));

async function open(label: string) {
  await renderWithTamagui(<CreateSheet visible onClose={jest.fn()} />);
  await fireEvent.press(screen.getByRole('link', { name: new RegExp(`^${label}\\.`) }));
  return mockPush.mock.calls.at(-1)?.[0];
}

beforeEach(() => mockPush.mockReset());

// At a venue, New > Drink saved to your home bar.
test('at a venue, what you make is the venue’s', async () => {
  mockMine = { venueId: 'bar', canAdd: true, label: 'Pale Moth' };
  expect(await open('Drink')).toBe('/add-cocktail?barId=bar');
  expect(await open('Wine')).toBe('/add-wine?barId=bar');
  expect(await open('Menu')).toBe('/menus/all?new=1');
});

test('at home, it is yours', async () => {
  mockMine = { venueId: null, canAdd: true, label: 'Your drinks' };
  expect(await open('Ingredient or prep')).toBe('/add-ingredient');
  expect(screen.getByText('In your home bar')).toBeTruthy();
  expect(screen.getByText('A night in: start fresh or from a saved menu')).toBeTruthy();
});

test('without the right to add at the venue, drinks lock with the role that opens them, and home is one tap away', async () => {
  mockMine = { venueId: 'bar', canAdd: false, label: 'Pale Moth' };
  await renderWithTamagui(<CreateSheet visible onClose={jest.fn()} />);
  expect(screen.getByText('Made at Pale Moth')).toBeTruthy();
  expect(screen.queryByRole('link', { name: /^Drink\./ })).toBeNull();
  expect(screen.getByText('Opens at Drink Creator')).toBeTruthy();
  expect(screen.getByRole('link', { name: /^Menu\./ })).toBeTruthy();
  expect(screen.getByRole('link', { name: /^Bring in\./ })).toBeTruthy();
  await fireEvent.press(screen.getByRole('link', { name: 'Make your own drink in your home bar' }));
  expect(mockSetMode).toHaveBeenLastCalledWith('home');
  expect(mockPush).toHaveBeenLastCalledWith('/add-cocktail');
});
