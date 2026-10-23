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
// The venue's switches come from their own query (hooks/useVenueFeatures.ts); here, a list per test.
let mockFeatures: string[] = [];
jest.mock('@/hooks/useVenueFeatures', () => {
  const { featureAtHome } = jest.requireActual<typeof import('@/lib/venueFeatures')>('@/lib/venueFeatures');
  const features = () => ({ ready: true, home: mockMode === 'home', has: (k: never) => (mockMode === 'home' ? featureAtHome(k) : mockFeatures.includes(k)) });
  return { useVenueFeatures: features, useVenueFeature: (k: never) => features().has(k) };
});

const mockOther = { ...mockVenue, id: 'pale', name: 'Pale Moth', roleLevel: 30 };
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ active: mockVenue, venues: [mockVenue, mockOther], enterVenue: mockEnterVenue }) }));
jest.mock('@/hooks/useViewAs', () => ({ useEffectiveRole: () => 40, useCanManageStaff: () => true }));
const ON = { id: 'm1', name: 'Autumn menu', barId: 'rye', startsAt: '2026-01-01T00:00:00Z', endsAt: null, kind: 'menu' };
const DRAFT = { id: 'm2', name: 'Winter', barId: 'rye', startsAt: null, endsAt: null, kind: 'menu' };
jest.mock('@/hooks/useMenus', () => ({ useVenueMenus: (barId: string | null) => ({ data: barId ? [ON, DRAFT, DRAFT] : [{ ...DRAFT, barId: null }] }) }));
jest.mock('@/hooks/useBackBar', () => ({ useItemLocations: () => ({ data: new Array(84).fill({}) }), useWaitingForSpot: () => ({ waiting: [{}, {}, {}] }) }));
let mockMembers: { user_id: string }[] = [];
let mockInvites: object[] = [];
jest.mock('@/hooks/useBarDetail', () => ({ useBarMembers: () => ({ data: mockMembers }) }));
jest.mock('@/hooks/useBarInvites', () => ({ useBarInvites: () => ({ data: mockInvites, isSuccess: true }) }));
jest.mock('@/hooks/useHomeBar', () => ({ useShelf: () => ({ data: ['a', 'b', 'c', 'd'] }), useBarDrinks: () => ({ canMake: new Array(7).fill({}) }) }));
jest.mock('@/hooks/useWeek', () => ({ useBarWeek: () => ({ data: [] }), useMyWeek: () => ({ data: undefined }), useWeekStart: () => new Date(2026, 9, 10) }));
jest.mock('@/hooks/useCollection', () => ({ useCollection: () => ({ data: { drinks: new Array(12).fill({}) } }) }));

beforeEach(() => {
  mockMode = 'venue';
  mockFeatures = ['tonight', 'backBar'];
  mockMembers = Array.from({ length: 9 }, (_, i) => ({ user_id: `u${i}` }));
  mockInvites = [{}, {}];
  jest.clearAllMocks();
});

test('a venue with nothing switched on: Menus, its Venue section and Settings', async () => {
  mockFeatures = [];
  await renderWithTamagui(<VenueMenuSheet onClose={jest.fn()} />);
  expect(screen.getAllByRole('link').map((el) => el.props.accessibilityLabel)).toEqual([
    'My team: 9 people · 2 invited',
    'Menus. Autumn menu on · 2 drafts',
    'Brand. Logo, colours and type',
    'Roles and access. Who sees what, by role',
    'Venue settings. Hours, address, units',
    'Settings. Your account and the app',
  ]);
});

test('at a venue: titled with it, My team first, then switch rows and the venue’s other places', async () => {
  const onClose = jest.fn();
  await renderWithTamagui(<VenueMenuSheet onClose={onClose} />);
  expect(screen.getByRole('heading', { name: 'Little Rye' })).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'Little Rye, Admin', checked: true })).toBeTruthy();
  expect(screen.getByText('More at Little Rye')).toBeTruthy();
  const places = screen.getAllByRole('link').map((el) => el.props.accessibilityLabel);
  expect(places).toEqual([
    'My team: 9 people · 2 invited',
    'Menus. Autumn menu on · 2 drafts',
    'Back bar. 84 placed · 3 waiting',
    'Brand. Logo, colours and type',
    'Roles and access. Who sees what, by role',
    'Venue settings. Hours, address, units',
    'This week. Nothing on yet',
    'Settings. Your account and the app',
  ]);
  await fireEvent.press(screen.getByRole('link', { name: /^Back bar\./ }));
  expect(onClose).toHaveBeenCalled();
  expect(mockPush).toHaveBeenLastCalledWith('/back-bar');
  await fireEvent.press(screen.getByRole('radio', { name: 'Pale Moth, Bartender' }));
  expect(mockEnterVenue).toHaveBeenLastCalledWith('pale');
  expect(mockNavigate).toHaveBeenLastCalledWith('/');
  await fireEvent.press(screen.getByRole('link', { name: /^My team:/ }));
  expect(mockPush).toHaveBeenLastCalledWith('/team');
});

test('an Admin alone on the team is asked to invite people', async () => {
  mockMembers = [{ user_id: 'me' }];
  mockInvites = [];
  await renderWithTamagui(<VenueMenuSheet onClose={jest.fn()} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Invite your team' }));
  expect(mockPush).toHaveBeenLastCalledWith('/team?invite=1');
});

test('at home: My Bar, Collection, You and Settings', async () => {
  mockMode = 'home';
  await renderWithTamagui(<VenueMenuSheet onClose={jest.fn()} />);
  expect(screen.getByRole('radio', { name: 'Home bar, Your shelf and collection', checked: true })).toBeTruthy();
  expect(screen.getByText('At home')).toBeTruthy();
  expect(screen.getAllByRole('link').map((el) => el.props.accessibilityLabel)).toEqual([
    'My Bar. 4 bottles · 7 drinks ready',
    'Collection. 12 to make · 1 menu',
    'You. Your profile, ranks and taste',
    'Settings. Your account and the app',
  ]);
  await fireEvent.press(screen.getByRole('link', { name: /^My Bar\./ }));
  expect(mockNavigate).toHaveBeenLastCalledWith('/bar');
});
