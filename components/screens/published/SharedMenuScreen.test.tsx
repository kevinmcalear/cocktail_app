import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { SharedMenuPage } from '@/hooks/useSharedMenu';

import { SharedMenuScreen } from './SharedMenuScreen';

const mockPush = jest.fn();
let mockMenu: SharedMenuPage | null = null;

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => false }) }));
jest.mock('@/ctx/AuthContext', () => jest.requireActual('@/jest.authMock').mockAuthContext(() => ({ user: null, loading: false })));
jest.mock('@/hooks/useSharedMenu', () => ({ useSharedMenu: () => ({ data: mockMenu, isPending: false }) }));

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
  };
});

describe('SharedMenuScreen', () => {
  test('a drink that isn’t public keeps its place with no name and no link; public drinks open their page', async () => {
    await renderWithTamagui(<SharedMenuScreen id="m1" />);
    expect(screen.getByText('House drink')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /House drink/ })).toBeNull();
    await fireEvent.press(screen.getByRole('link', { name: /Porch Sour/ }));
    expect(mockPush).toHaveBeenCalledWith('/d/d1');
  });

  test('credits the owner, opening their profile', async () => {
    await renderWithTamagui(<SharedMenuScreen id="m1" />);
    await fireEvent.press(screen.getByRole('link', { name: /Shared by Sam/ }));
    expect(mockPush).toHaveBeenCalledWith('/p/sam');
  });
});
