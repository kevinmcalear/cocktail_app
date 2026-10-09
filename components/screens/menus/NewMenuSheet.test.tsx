import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { NewMenuSheet } from './NewMenuSheet';

const mockPush = jest.fn();
const mockCreate = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
let mockMode: 'home' | 'venue' = 'home';
const mockVenue = { id: 'bar', name: 'Little Rye', roleLevel: 50 };
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => (mockMode === 'venue' ? { venues: [mockVenue], active: mockVenue } : { venues: [], active: null }) }));
jest.mock('@/hooks/useMode', () => ({ useMode: () => ({ mode: mockMode }) }));
jest.mock('@/hooks/useMenus', () => ({ useMenu: () => ({ data: undefined }) }));
jest.mock('@/hooks/useMenuMutations', () => ({
  useMenuLayouts: () => ({ data: [] }),
  useCreateMenu: () => ({ mutateAsync: mockCreate, isPending: false }),
}));

const now = Date.parse('2026-10-09T12:00:00Z');

beforeEach(() => {
  mockMode = 'home';
  mockVenue.roleLevel = 50;
  mockPush.mockReset();
  mockCreate.mockReset();
});

test('a home menu takes three steps: name, start from, night; the card fills in', async () => {
  mockCreate.mockResolvedValue('new-id');
  await renderWithTamagui(<NewMenuSheet visible onClose={jest.fn()} menus={[]} now={now} />);
  expect(screen.getByText('1 of 3')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Friday at ours');
  expect(screen.getAllByText('Friday at ours').length).toBeGreaterThan(0);
  await fireEvent.press(screen.getByRole('button', { name: 'Next: start from' }));
  expect(screen.getByText('2 of 3')).toBeTruthy();
  expect(screen.getByText('One empty section')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Next: night' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Tonight' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Create draft' }));
  expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ barId: null, layout: expect.objectContaining({ name: 'Friday at ours' }) }));
  expect(mockCreate.mock.calls[0][0].night.menuDate).not.toBeNull();
  expect(mockPush).toHaveBeenCalledWith('/menus/new-id/edit');
});

test('with no name, making it goes back to the name step and says why', async () => {
  await renderWithTamagui(<NewMenuSheet visible onClose={jest.fn()} menus={[]} now={now} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Next: start from' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Next: night' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Create draft' }));
  expect(mockCreate).not.toHaveBeenCalled();
  expect(screen.getByText('Give the menu a name.')).toBeTruthy();
  expect(screen.getByText('1 of 3')).toBeTruthy();
});

test('a venue menu takes two steps, with no night', async () => {
  mockMode = 'venue';
  mockCreate.mockResolvedValue('venue-id');
  await renderWithTamagui(<NewMenuSheet visible onClose={jest.fn()} menus={[]} now={now} />);
  expect(screen.getByText('1 of 2')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Spring menu');
  await fireEvent.press(screen.getByRole('button', { name: 'Next: start from' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Create draft' }));
  expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ barId: 'bar', night: undefined }));
});

// A Bartender at a venue whose settings let Bartenders build menus got another venue, or a personal menu.
test('a venue menu is for the venue you are in, even below Drink Creator', async () => {
  mockMode = 'venue';
  mockVenue.roleLevel = 30;
  mockCreate.mockResolvedValue('venue-id');
  await renderWithTamagui(<NewMenuSheet visible onClose={jest.fn()} menus={[]} now={now} />);
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Spring menu');
  await fireEvent.press(screen.getByRole('button', { name: 'Next: start from' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Create draft' }));
  expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ barId: 'bar' }));
});
