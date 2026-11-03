import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';

import { VenueSwitcher } from './VenueSwitcher';

const mockPush = jest.fn();
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, navigate: mockNavigate }), usePathname: () => '/', useSegments: () => [] }));
let mockMode: 'venue' | 'home' = 'venue';
const mockEnterVenue = jest.fn();
jest.mock('@/hooks/useMode', () => ({ useMode: () => ({ mode: mockMode, setMode: jest.fn() }) }));
const mockVenue = { id: 'rye', name: 'Little Rye', logoUrl: null, accent: null, displayFace: 'redaction', groundTint: null, roleLevel: 40 };
const mockOther = { ...mockVenue, id: 'pale', name: 'Pale Moth', roleLevel: 30 };
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ active: mockVenue, venues: [mockVenue, mockOther], isLoading: false, enterVenue: mockEnterVenue }) }));
let mockRole = 40;
jest.mock('@/hooks/useViewAs', () => ({ useEffectiveRole: () => mockRole, useCanManageStaff: () => mockRole >= 40 }));
let mockCaps: string[] = ['brand', 'prep'];
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ data: mockCaps }) }));
jest.mock('@/hooks/useMenus', () => ({ useVenueMenus: () => ({ data: [{ id: 'm1', name: 'Autumn', barId: 'rye', kind: 'menu', startsAt: '2020-01-01T00:00:00Z', endsAt: null, itemIds: [] }] }) }));
jest.mock('@/hooks/usePrepList', () => ({ usePrepData: () => ({ data: undefined }) }));
jest.mock('@/hooks/useHomeBar', () => ({ useShelf: () => ({ data: ['a', 'b', 'c'] }) }));
jest.mock('@/lib/clipboardPeek', () => ({ readClipboard: async () => null }));
// The venue's switches (lib/venueFeatures.ts): all on unless a test turns some off.
let mockOff: string[] = [];
jest.mock('@/hooks/useVenueFeatures', () => ({
  useVenueFeatures: () => ({ ready: true, has: (k: string) => !mockOff.includes(k), home: '/' }),
  useVenueFeature: (k: string) => !mockOff.includes(k),
}));
// Jest's views never measure, so the Switch menu opens at a made-up place.
jest.mock('@/components/ds/usePopover', () => {
  const { useState } = jest.requireActual<typeof import('react')>('react');
  return {
    usePopover: () => {
      const [anchor, setAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
      return { anchor, open: () => setAnchor({ x: 0, y: 0, width: 80, height: 44 }), close: () => setAnchor(null) };
    },
  };
});

beforeEach(() => {
  mockMode = 'venue';
  mockRole = 40;
  mockCaps = ['brand', 'prep'];
  mockOff = [];
  jest.clearAllMocks();
});

const links = () => screen.getAllByRole('link').map((el) => el.props.accessibilityLabel);
const open = async (name: string) => {
  await renderWithProviders(<VenueSwitcher />);
  await fireEvent.press(screen.getByRole('button', { name }));
};

test('at a bar, an Admin: the mark opens every page, the sidebar group first, then More and You', async () => {
  await open('Venue: Little Rye. Switch');
  expect(screen.getByRole('heading', { name: 'Little Rye' })).toBeTruthy();
  expect(links()).toEqual(['Menus. Autumn, on now', 'House-made', 'Team', 'Bar settings', 'Study', 'Glassware', 'This week', 'Rota', 'Theme', 'Roles and access', 'Settings']);
  await fireEvent.press(screen.getByRole('link', { name: 'Rota' }));
  expect(mockPush).toHaveBeenLastCalledWith('/team/rota');
});

test('a bartender with fewer capabilities, and a bar with Prep and Study switched off', async () => {
  mockRole = 20;
  mockCaps = [];
  mockOff = ['prep', 'study', 'tonight'];
  await open('Venue: Little Rye. Switch');
  expect(links()).toEqual(['Menus. Autumn, on now', 'Team', 'Bar settings', 'Glassware', 'Rota', 'Roles and access', 'Settings']);
});

test('at home: Shelf and Menus, then You', async () => {
  mockMode = 'home';
  await open('Home bar. Switch');
  expect(screen.getByRole('heading', { name: 'Home' })).toBeTruthy();
  expect(links()).toEqual(['Shelf. 3', 'Menus', 'Settings']);
});

test('Switch inside the sheet lists your places and switches', async () => {
  await open('Venue: Little Rye. Switch');
  await fireEvent.press(screen.getByRole('button', { name: 'Switch place' }));
  expect(screen.getAllByRole('menuitem').map((el) => el.props.accessibilityLabel)).toEqual(['Little Rye, picked', 'Pale Moth', 'Home', 'Join a bar with a link']);
  await fireEvent.press(screen.getByRole('menuitem', { name: 'Pale Moth' }));
  expect(mockEnterVenue).toHaveBeenLastCalledWith('pale');
});
