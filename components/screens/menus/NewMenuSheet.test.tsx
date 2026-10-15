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
jest.mock('@/hooks/useVenueSetup', () => ({ useVenuePage: () => ({ data: null }) }));
const mockPick = jest.fn();
jest.mock('@/lib/readMenu', () => ({ ...jest.requireActual('@/lib/readMenu'), pickMenuPhotos: (n: number) => mockPick(n), takeMenuPhoto: () => mockPick(1) }));
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
  mockPick.mockReset().mockResolvedValue([]);
});

test('a home menu goes start, name, when: tapping a start goes on, and the card fills in', async () => {
  mockCreate.mockResolvedValue('new-id');
  await renderWithTamagui(<NewMenuSheet visible onClose={jest.fn()} menus={[]} now={now} />);
  expect(screen.getByText('1 of 3')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^Next/ })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: /^Blank/ }));
  expect(screen.getByText('2 of 3')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Friday at ours');
  expect(screen.getAllByText('Friday at ours', { includeHiddenElements: true }).length).toBeGreaterThan(0);
  await fireEvent.press(screen.getByRole('button', { name: 'Next: when' }));
  expect(screen.getByText('3 of 3')).toBeTruthy();
  await fireEvent.press(screen.getByRole('radio', { name: 'Tonight' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Create draft' }));
  expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ barId: null, layout: expect.objectContaining({ name: 'Friday at ours' }) }));
  expect(mockCreate.mock.calls[0][0].night.menuDate).not.toBeNull();
  expect(mockPush).toHaveBeenCalledWith('/menus/new-id/edit');
});

test('with no name, making it goes back to the name step and says why', async () => {
  await renderWithTamagui(<NewMenuSheet visible onClose={jest.fn()} menus={[]} now={now} />);
  await fireEvent.press(screen.getByRole('button', { name: /^Blank/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Next: when' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Create draft' }));
  expect(mockCreate).not.toHaveBeenCalled();
  expect(screen.getByText('Give the menu a name.')).toBeTruthy();
  expect(screen.getByText('2 of 3')).toBeTruthy();
});

test('name ideas follow the season and month; tapping one names the menu', async () => {
  mockMode = 'venue';
  mockCreate.mockResolvedValue('venue-id');
  await renderWithTamagui(<NewMenuSheet visible onClose={jest.fn()} menus={[]} now={now} />);
  await fireEvent.press(screen.getByRole('button', { name: /^Blank/ }));
  expect(screen.getByRole('radio', { name: 'October' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('radio', { name: 'Autumn menu' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Next: when' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Create draft' }));
  expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ barId: 'bar', night: undefined, plan: { plannedStartsAt: null, plannedEndsAt: null }, layout: expect.objectContaining({ name: 'Autumn menu' }) }));
});

test('a venue menu can go on one of the next two Mondays', async () => {
  mockMode = 'venue';
  mockCreate.mockResolvedValue('venue-id');
  await renderWithTamagui(<NewMenuSheet visible onClose={jest.fn()} menus={[]} now={now} />);
  await fireEvent.press(screen.getByRole('button', { name: /^Blank/ }));
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Halloween');
  await fireEvent.press(screen.getByRole('button', { name: 'Next: when' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'From a date' }));
  // Friday 9 October: Monday the 12th and the 19th.
  await fireEvent.press(screen.getByRole('radio', { name: /\b12\b/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Create draft' }));
  expect(mockCreate.mock.calls[0][0].plan).toEqual({ plannedStartsAt: new Date('2026-10-12T00:00:00').toISOString(), plannedEndsAt: null });
});

test('Paste a list makes the draft and opens the builder on the paste sheet', async () => {
  mockMode = 'venue';
  mockCreate.mockResolvedValue('venue-id');
  await renderWithTamagui(<NewMenuSheet visible onClose={jest.fn()} menus={[]} now={now} />);
  await fireEvent.press(screen.getByRole('button', { name: /^Paste a list/ }));
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Spring menu');
  await fireEvent.press(screen.getByRole('button', { name: 'Next: when' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Create draft' }));
  expect(mockPush).toHaveBeenCalledWith('/menus/venue-id/edit?paste=1');
});

test('a photo skips the name: two steps, and it needs a page to read', async () => {
  mockMode = 'venue';
  await renderWithTamagui(<NewMenuSheet visible onClose={jest.fn()} menus={[]} now={now} />);
  await fireEvent.press(screen.getByRole('button', { name: /^Snap the menu/ }));
  expect(mockPick).toHaveBeenCalled();
  expect(screen.getByText('2 of 2')).toBeTruthy();
  expect(screen.getByLabelText('Name')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Read the menu' }));
  expect(screen.getByText('Add a photo of the menu first.')).toBeTruthy();
  expect(mockCreate).not.toHaveBeenCalled();
});
