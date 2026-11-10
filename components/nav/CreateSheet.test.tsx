import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { renderWithProviders } from '@/jest.setup';

import { CreateSheet } from './CreateSheet';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
const mockSetMode = jest.fn();
jest.mock('@/hooks/useMode', () => ({ useMode: () => ({ mode: 'venue', setMode: mockSetMode }) }));
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ data: [] }), useCapabilityOpensAt: () => ({ data: 35 }) }));
let mockMine = { venueId: null as string | null, canAdd: true, label: 'Your drinks' };
jest.mock('@/hooks/useSearchMine', () => ({ useSearchMine: () => mockMine }));

async function open(label: string) {
  await renderWithProviders(<CreateSheet visible onClose={jest.fn()} />);
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
  expect(await open('A bottle you buy')).toBe('/add-ingredient?barId=home');
  expect(await open('Something you make')).toBe('/make-recipe?barId=home');
  expect(screen.getByText('In your home bar')).toBeTruthy();
  expect(screen.getByText('For your shelf, or to pour from')).toBeTruthy();
});

test('without the right to add at the venue, drinks lock with the role that opens them, and home is one tap away', async () => {
  mockMine = { venueId: 'bar', canAdd: false, label: 'Pale Moth' };
  await renderWithProviders(<CreateSheet visible onClose={jest.fn()} />);
  expect(screen.getByText('Made at Pale Moth')).toBeTruthy();
  expect(screen.queryByRole('link', { name: /^Drink\./ })).toBeNull();
  expect(screen.getByText('Opens at Drink Creator')).toBeTruthy();
  expect(screen.getByRole('link', { name: /^Menu\./ })).toBeTruthy();
  await fireEvent.press(screen.getByRole('link', { name: 'Make your own drink in your home bar' }));
  expect(mockSetMode).toHaveBeenLastCalledWith('home');
  expect(mockPush).toHaveBeenLastCalledWith('/add-cocktail?barId=home');
});

// Review of #1181: on Android a row (or the scrim) went back to Add, which opened over the page it had just pushed.
test('on Android, the arrow goes back and a row closes', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  mockMine = { venueId: 'bar', canAdd: true, label: 'Pale Moth' };
  const onClose = jest.fn();
  const onBack = jest.fn();
  await renderWithProviders(<CreateSheet visible onClose={onClose} onBack={onBack} />);
  await fireEvent.press(screen.getByRole('link', { name: /^A bottle you buy\./ }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onBack).not.toHaveBeenCalled();
  expect(mockPush).toHaveBeenLastCalledWith('/add-ingredient?barId=bar');
  onClose.mockReset();
  await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
  expect(onClose).not.toHaveBeenCalled();
});
