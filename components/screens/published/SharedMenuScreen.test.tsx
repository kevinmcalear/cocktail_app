import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';
import type { SharedMenuPage } from '@/hooks/useSharedMenu';

import { SharedMenuScreen } from './SharedMenuScreen';

const mockPush = jest.fn();
let mockMenu: SharedMenuPage | null = null;

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => false }) }));
jest.mock('@/ctx/AuthContext', () => jest.requireActual('@/jest.authMock').mockAuthContext(() => ({ user: null, loading: false })));
jest.mock('@/hooks/useSharedMenu', () => ({ useSharedMenu: () => ({ data: mockMenu, isPending: false }) }));
jest.mock('@/hooks/useItemSketch', () => ({ useItemSketch: () => ({ data: null }) }));
jest.mock('@/lib/shareLink', () => ({ shareOrCopy: jest.fn() }));

const drink = (id: string, name: string) => ({
  id,
  name,
  itemType: 'cocktail',
  description: `${name} notes`,
  barId: null,
  glasswareId: null,
  iceId: null,
  familyId: null,
  origin: null,
  abv: null,
  publishMode: 'description' as const,
  publishedAt: null,
  imageUrl: null,
  imageIsGenerated: false,
  creatorProfileId: null,
  originBarProfileId: null,
  originYear: null,
  riffOfId: null,
  creditStatus: null,
});

beforeEach(() => {
  mockPush.mockClear();
  mockMenu = {
    id: 'm1',
    name: 'Saturday at home',
    menuDate: null,
    coverUrl: null,
    owner: { profileId: 'p1', name: 'Sam', handle: 'sam' },
    sections: [{ id: 's1', name: 'Aperitivo', drinks: [null, drink('d1', 'Porch Sour')] }],
    ingredients: {},
  };
});

describe('SharedMenuScreen', () => {
  test('a drink kept private holds its place with no name and no link', async () => {
    await renderWithProviders(<SharedMenuScreen id="m1" />);
    expect(screen.getByText('House drink')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /House drink/ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /Porch Sour/ }));
    expect(mockPush).toHaveBeenCalledWith('/d/d1');
  });

  test('says whose menu and which night, with no prices, and a guest signs in to report it', async () => {
    mockMenu = { ...mockMenu!, menuDate: '2026-10-31' };
    await renderWithProviders(<SharedMenuScreen id="m1" />);
    expect(screen.getByText(/SAM.S MENU · SAT 31 OCT/)).toBeTruthy();
    expect(screen.getByText(/you see what is in each drink, not the amounts/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('link', { name: 'Report this menu' }));
    expect(mockPush).toHaveBeenCalledWith('/auth/login');
  });

  test("a drink's line is its ingredients when there are names, else its description", async () => {
    const g = (name: string, brand = false) => ({ name, brand });
    mockMenu = { ...mockMenu!, ingredients: { d1: [g('Rye'), g('Lemon Juice'), g('Rye'), g('Green Chartreuse', true)] } };
    await renderWithProviders(<SharedMenuScreen id="m1" />);
    expect(screen.getByText('Rye, lemon juice, Green Chartreuse')).toBeTruthy();
    expect(screen.queryByText('Porch Sour notes')).toBeNull();
  });

  test('no way back but home', async () => {
    await renderWithProviders(<SharedMenuScreen id="m1" />);
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    await fireEvent.press(screen.getByRole('link', { name: 'Cocktail' }));
    expect(mockPush).toHaveBeenCalledWith('/');
  });
});
