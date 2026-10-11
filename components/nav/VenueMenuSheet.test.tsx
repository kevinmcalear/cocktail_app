import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { VenueMenuSheet } from './VenueMenuSheet';

const mockPush = jest.fn();
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, navigate: mockNavigate }) }));
let mockMode: 'venue' | 'home' = 'venue';
const mockSetMode = jest.fn();
const mockEnterVenue = jest.fn();
jest.mock('@/hooks/useMode', () => ({ useMode: () => ({ mode: mockMode, setMode: mockSetMode }) }));
const mockVenue = { id: 'rye', name: 'Little Rye', logoUrl: null, accent: null, displayFace: 'instrument', groundTint: null, roleLevel: 40 };
const mockOther = { ...mockVenue, id: 'pale', name: 'Pale Moth', roleLevel: 30 };
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ active: mockVenue, venues: [mockVenue, mockOther], enterVenue: mockEnterVenue }) }));
jest.mock('@/hooks/useViewAs', () => ({ useEffectiveRole: () => 40 }));
const ON = { id: 'm1', name: 'Autumn menu', barId: 'rye', startsAt: '2026-01-01T00:00:00Z', endsAt: null, kind: 'menu' };
const DRAFT = { id: 'm2', name: 'Winter', barId: 'rye', startsAt: null, endsAt: null, kind: 'menu' };
jest.mock('@/hooks/useMenus', () => ({ useVenueMenus: (barId: string | null) => ({ data: barId ? [ON, DRAFT, DRAFT] : [{ ...DRAFT, barId: null }] }) }));
jest.mock('@/hooks/useBackBar', () => ({ useItemLocations: () => ({ data: new Array(84).fill({}) }), useWaitingForSpot: () => ({ waiting: [{}, {}, {}] }) }));
jest.mock('@/hooks/useBarDetail', () => ({ useBarMembers: () => ({ data: new Array(9).fill({}) }) }));
jest.mock('@/hooks/useBarInvites', () => ({ useBarInvites: () => ({ data: [{}, {}] }) }));
jest.mock('@/hooks/useHomeBar', () => ({ useShelf: () => ({ data: ['a', 'b', 'c', 'd'] }) }));
jest.mock('@/hooks/useCollection', () => ({ useCollection: () => ({ data: { drinks: new Array(12).fill({}) } }) }));

beforeEach(() => {
  mockMode = 'venue';
  jest.clearAllMocks();
});

test('at a venue: switch rows, then the venue’s places with their counts', async () => {
  const onClose = jest.fn();
  await renderWithTamagui(<VenueMenuSheet onClose={onClose} />);
  expect(screen.getByRole('radio', { name: 'Little Rye, Admin', checked: true })).toBeTruthy();
  expect(screen.getByText('At Little Rye')).toBeTruthy();
  const places = screen.getAllByRole('link').map((el) => el.props.accessibilityLabel);
  expect(places).toEqual([
    'Menus. Autumn menu on · 2 drafts',
    'Back bar. 84 placed · 3 waiting',
    'My team. 9 people · 2 invited',
    'Brand. Logo, colours and type',
    'Venue settings. Hours, address, units',
    'Settings. Your account and the app',
  ]);
  await fireEvent.press(screen.getByRole('link', { name: /^Back bar\./ }));
  expect(onClose).toHaveBeenCalled();
  expect(mockPush).toHaveBeenLastCalledWith('/back-bar');
  await fireEvent.press(screen.getByRole('radio', { name: 'Pale Moth, Bartender' }));
  expect(mockEnterVenue).toHaveBeenLastCalledWith('pale');
  expect(mockNavigate).toHaveBeenLastCalledWith('/');
});

test('at home: My Bar, Collection, You and Settings', async () => {
  mockMode = 'home';
  await renderWithTamagui(<VenueMenuSheet onClose={jest.fn()} />);
  expect(screen.getByRole('radio', { name: 'Home bar, Your shelf and collection', checked: true })).toBeTruthy();
  expect(screen.getByText('At home')).toBeTruthy();
  expect(screen.getAllByRole('link').map((el) => el.props.accessibilityLabel)).toEqual([
    'My Bar. 4 bottles',
    'Collection. 12 to make · 1 menu',
    'You. Your profile, ranks and taste',
    'Settings. Your account and the app',
  ]);
  await fireEvent.press(screen.getByRole('link', { name: /^My Bar\./ }));
  expect(mockNavigate).toHaveBeenLastCalledWith('/bar');
});
