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
  const features = () => ({ ready: true, home: mockMode === 'home', on: mockMode === 'home' ? [] : mockFeatures, has: (k: never) => (mockMode === 'home' ? featureAtHome(k) : mockFeatures.includes(k)) });
  return { useVenueFeatures: features, useVenueFeature: (k: never) => features().has(k) };
});

const mockOther = { ...mockVenue, id: 'pale', name: 'Pale Moth', roleLevel: 30 };
let mockVenues = [mockVenue, mockOther];
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ active: mockVenues[0] ?? null, venues: mockVenues, enterVenue: mockEnterVenue }) }));
let mockRole = 40;
jest.mock('@/hooks/useViewAs', () => ({ useEffectiveRole: () => mockRole, useCanManageStaff: () => mockRole >= 40 }));
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
// Jest's views never measure, so the Switch menu opens at a made-up place.
jest.mock('@/components/ds', () => {
  const actual = jest.requireActual<typeof import('@/components/ds')>('@/components/ds');
  const { useState } = jest.requireActual<typeof import('react')>('react');
  return {
    ...actual,
    usePopover: () => {
      const [anchor, setAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
      return { anchor, open: () => setAnchor({ x: 0, y: 0, width: 80, height: 44 }), close: () => setAnchor(null) };
    },
  };
});
jest.mock('@/hooks/useCollection', () => ({ useCollection: () => ({ data: { drinks: new Array(12).fill({}) } }) }));

beforeEach(() => {
  mockMode = 'venue';
  mockVenues = [mockVenue, mockOther];
  mockFeatures = ['tonight', 'backBar'];
  mockMembers = Array.from({ length: 9 }, (_, i) => ({ user_id: `u${i}` }));
  mockInvites = [{}, {}];
  mockRole = 40;
  jest.clearAllMocks();
});

test('a venue with nothing switched on: Menus, then Venue with Features, then Settings', async () => {
  mockFeatures = [];
  await renderWithTamagui(<VenueMenuSheet onClose={jest.fn()} />);
  expect(screen.getAllByRole('link').map((el) => el.props.accessibilityLabel)).toEqual([
    'Menus. 1 on',
    'My team. 9 people',
    'Features',
    'Brand',
    'Roles and access',
    'Venue settings',
    'Settings',
  ]);
});

test('at a venue: titled with it, its working pages first, then Venue and You', async () => {
  const onClose = jest.fn();
  await renderWithTamagui(<VenueMenuSheet onClose={onClose} />);
  expect(screen.getByRole('heading', { name: 'Little Rye' })).toBeTruthy();
  expect(screen.getByText('Admin')).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Venue' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'You' })).toBeTruthy();
  // The switch list is behind Switch now, not rows in the sheet.
  expect(screen.queryByRole('radio')).toBeNull();
  const places = screen.getAllByRole('link').map((el) => el.props.accessibilityLabel);
  expect(places).toEqual([
    'Menus. 1 on',
    'Back bar. 3 waiting',
    'This week',
    'My team. 9 people',
    'Features. 2 of 8 on',
    'Brand',
    'Roles and access',
    'Venue settings',
    'Settings',
  ]);
  await fireEvent.press(screen.getByRole('link', { name: /^Back bar/ }));
  expect(onClose).toHaveBeenCalled();
  expect(mockPush).toHaveBeenLastCalledWith('/back-bar');
  await fireEvent.press(screen.getByRole('link', { name: /^Features/ }));
  expect(mockPush).toHaveBeenLastCalledWith('/settings/bar/rye/features');
  await fireEvent.press(screen.getByRole('link', { name: /^My team/ }));
  expect(mockPush).toHaveBeenLastCalledWith('/team');
});

test('Switch opens a menu of Home bar and the venues; a pick switches', async () => {
  const onClose = jest.fn();
  await renderWithTamagui(<VenueMenuSheet onClose={onClose} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Switch to Home bar or another venue' }));
  expect(screen.getAllByRole('menuitem').map((el) => el.props.accessibilityLabel)).toEqual(['Home bar', 'Little Rye, picked', 'Pale Moth']);
  await fireEvent.press(screen.getByRole('menuitem', { name: 'Pale Moth' }));
  expect(onClose).toHaveBeenCalled();
  expect(mockEnterVenue).toHaveBeenLastCalledWith('pale');
  expect(mockNavigate).toHaveBeenLastCalledWith('/');
});

test('a Bartender sees no Features: only Admins switch them', async () => {
  mockRole = 30;
  await renderWithTamagui(<VenueMenuSheet onClose={jest.fn()} />);
  expect(screen.queryByRole('link', { name: /^Features/ })).toBeNull();
});

test('an Admin alone on the team gets Invite on My team', async () => {
  mockMembers = [{ user_id: 'me' }];
  mockInvites = [];
  await renderWithTamagui(<VenueMenuSheet onClose={jest.fn()} />);
  await fireEvent.press(screen.getByRole('link', { name: 'My team. Invite' }));
  expect(mockPush).toHaveBeenLastCalledWith('/team?invite=1');
});

test('at home: titled Home bar, My Bar, Collection and You, then Settings', async () => {
  mockMode = 'home';
  await renderWithTamagui(<VenueMenuSheet onClose={jest.fn()} />);
  expect(screen.getByRole('heading', { name: 'Home bar' })).toBeTruthy();
  expect(screen.getAllByRole('link').map((el) => el.props.accessibilityLabel)).toEqual([
    'My Bar. 4 bottles',
    'Collection. 12 to make',
    'You',
    'Settings',
  ]);
  await fireEvent.press(screen.getByRole('link', { name: /^My Bar/ }));
  expect(mockNavigate).toHaveBeenLastCalledWith('/bar');
});

test('with no venues there is no Switch: nowhere to switch to', async () => {
  mockMode = 'home';
  mockVenues = [];
  await renderWithTamagui(<VenueMenuSheet onClose={jest.fn()} />);
  expect(screen.getByRole('heading', { name: 'Home bar' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Switch to Home bar or another venue' })).toBeNull();
});
