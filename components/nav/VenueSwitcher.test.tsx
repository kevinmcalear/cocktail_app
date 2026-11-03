import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';

import { VenueSwitcher } from './VenueSwitcher';

const mockPush = jest.fn();
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, navigate: mockNavigate }) }));
let mockMode: 'venue' | 'home' = 'venue';
const mockSetMode = jest.fn();
const mockEnterVenue = jest.fn();
jest.mock('@/hooks/useMode', () => ({ useMode: () => ({ mode: mockMode, setMode: mockSetMode }) }));
const mockVenue = { id: 'rye', name: 'Little Rye', logoUrl: null, accent: null, displayFace: 'redaction', groundTint: null, roleLevel: 40 };
const mockOther = { ...mockVenue, id: 'pale', name: 'Pale Moth', roleLevel: 30 };
let mockVenues = [mockVenue, mockOther];
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ active: mockVenues[0] ?? null, venues: mockVenues, isLoading: false, enterVenue: mockEnterVenue }) }));
// Jest's views never measure, so the menu opens at a made-up place.
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
  mockVenues = [mockVenue, mockOther];
  jest.clearAllMocks();
});

const items = () => screen.getAllByRole('menuitem').map((el) => el.props.accessibilityLabel);

test('the mark opens your places: each venue with the one you are in checked, then Home', async () => {
  await renderWithProviders(<VenueSwitcher />);
  await fireEvent.press(screen.getByRole('button', { name: 'Venue: Little Rye. Switch' }));
  expect(items()).toEqual(['Little Rye, picked', 'Pale Moth', 'Home']);
  expect(screen.getByText('Admin')).toBeTruthy();
  expect(screen.getByText('Your shelf and menus')).toBeTruthy();
  await fireEvent.press(screen.getByRole('menuitem', { name: 'Pale Moth' }));
  expect(mockEnterVenue).toHaveBeenLastCalledWith('pale');
  expect(mockNavigate).toHaveBeenLastCalledWith('/');
});

test('Home is picked at home, and a pick switches mode', async () => {
  mockMode = 'home';
  await renderWithProviders(<VenueSwitcher />);
  await fireEvent.press(screen.getByRole('button', { name: 'Home bar. Switch' }));
  expect(items()).toEqual(['Little Rye', 'Pale Moth', 'Home, picked']);
  await fireEvent.press(screen.getByRole('menuitem', { name: 'Little Rye' }));
  expect(mockEnterVenue).toHaveBeenLastCalledWith('rye');
});

test('with no venues the menu is Home and "Run a bar? Set it up"', async () => {
  mockMode = 'home';
  mockVenues = [];
  await renderWithProviders(<VenueSwitcher />);
  await fireEvent.press(screen.getByRole('button', { name: 'Home bar. Switch' }));
  expect(items()).toEqual(['Home, picked', 'Run a bar? Set it up']);
  await fireEvent.press(screen.getByRole('menuitem', { name: 'Run a bar? Set it up' }));
  expect(mockPush).toHaveBeenLastCalledWith('/venue-setup?step=find');
});
