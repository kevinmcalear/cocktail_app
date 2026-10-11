import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { MyProfile } from '@/hooks/useMyProfile';

import { MyProfileScreen } from './MyProfileScreen';

const mockPush = jest.fn();
const mockMutate = jest.fn();
const mockSaveSharing = jest.fn();
let mockProfile: MyProfile | null = null;
let mockSaveError: Error | null = null;

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => true }) }));
jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', user_metadata: { full_name: 'Jo Juniper' } }, loading: false }) }));
jest.mock('@/components/ui/UserAvatar', () => ({ CurrentUserAvatar: () => null }));
jest.mock('@/hooks/useProfiles', () => ({ useProfilePositions: () => ({ data: [] }) }));
jest.mock('./useSharingCounts', () => ({
  useSharingCounts: () => ({ had: { shown: 4, total: 7 }, bars: { shown: 2, total: 4 }, originals: { shown: 3, total: 3 }, awards: { shown: 0, total: 0 } }),
  modeCount: jest.requireActual('./useSharingCounts').modeCount,
}));
jest.mock('@/hooks/useMyProfile', () => ({
  useMyProfile: () => ({ data: mockProfile, isPending: false, error: null }),
  useMyHiddenCity: () => ({ data: null }),
  useSaveMyProfile: () => ({ mutate: mockMutate, isPending: false, error: mockSaveError }),
  useSaveSharing: () => ({ mutate: mockSaveSharing, isPending: false, error: null }),
}));

const profile = (over: Partial<MyProfile> = {}): MyProfile => ({
  id: 'p1', handle: 'jo.home', displayName: 'Jo', bio: null, instagram: null, isPublic: true,
  sharing: { had: 'picked', bars: 'picked', originals: 'all' }, showsDates: false, isModerated: false,
  tagline: 'Home bartender', headlinePositionId: null, showsPhoto: true, awardsMode: 'all', showsCity: true, city: 'Melbourne', ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockProfile = null;
  mockSaveError = null;
});

describe('MyProfileScreen', () => {
  test('a first profile starts from your name, public, and saves what you typed', async () => {
    await renderWithTamagui(<MyProfileScreen />);
    expect(screen.getByLabelText('Name').props.value).toBe('Jo Juniper');
    expect(screen.getByLabelText('Handle').props.value).toBe('jo.juniper');
    expect(screen.getByRole('radio', { name: 'Public', checked: true })).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Handle'), '@Jo.Home');
    await fireEvent.press(screen.getByRole('button', { name: 'Make my profile' }));
    expect(mockMutate).toHaveBeenCalledWith({ id: null, draft: { name: 'Jo Juniper', handle: '@Jo.Home', bio: '', instagram: '', isPublic: true, tagline: '', headlinePositionId: null, showsPhoto: true } });
  });

  test('a bad handle is caught before saving', async () => {
    await renderWithTamagui(<MyProfileScreen />);
    await fireEvent.changeText(screen.getByLabelText('Handle'), 'a');
    await fireEvent.press(screen.getByRole('button', { name: 'Make my profile' }));
    expect(screen.getByText(/Use 3 to 30 letters/)).toBeTruthy();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  test('the hub: three pages with their summaries, and Preview', async () => {
    mockProfile = profile();
    await renderWithTamagui(<MyProfileScreen />);
    expect(screen.getByText('Name, photo for people on Cocktail, Home bartender, Melbourne shown')).toBeTruthy();
    expect(screen.getByText('Drinks: Picked, 4 of 7 · Bars: Picked, 2 of 4 · Originals: All')).toBeTruthy();
    expect(screen.getByText('0 jobs shown')).toBeTruthy();
    await fireEvent.press(screen.getByRole('link', { name: /^What people see/ }));
    expect(mockPush).toHaveBeenCalledWith('/settings/profile-sharing');
    await fireEvent.press(screen.getByLabelText('Preview'));
    expect(mockPush).toHaveBeenCalledWith('/you');
  });

  test('Who can see it saves straight away', async () => {
    mockProfile = profile();
    await renderWithTamagui(<MyProfileScreen />);
    expect(screen.getByText(/People signed in to Cocktail see your page/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Only me' }));
    expect(mockSaveSharing).toHaveBeenCalledWith({ id: 'p1', isPublic: false });
  });

  test('a new handle saves when you leave the field', async () => {
    mockProfile = profile();
    await renderWithTamagui(<MyProfileScreen />);
    await fireEvent.changeText(screen.getByLabelText('Handle'), 'jo.bar');
    await fireEvent(screen.getByLabelText('Handle'), 'blur');
    expect(mockMutate.mock.calls[0][0]).toMatchObject({ id: 'p1', draft: { handle: 'jo.bar', name: 'Jo', tagline: 'Home bartender' } });
  });
});
