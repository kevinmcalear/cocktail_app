import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { MyProfile } from '@/hooks/useMyProfile';

import { MyProfileScreen } from './MyProfileScreen';

const mockPush = jest.fn();
const mockMutate = jest.fn();
let mockProfile: MyProfile | null = null;
let mockSaveError: Error | null = null;

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => true }) }));
jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', user_metadata: { full_name: 'Jo Juniper' } }, loading: false }) }));
jest.mock('@/hooks/useMyProfile', () => ({
  useMyProfile: () => ({ data: mockProfile, isPending: false, error: null }),
  useSaveMyProfile: () => ({ mutate: mockMutate, isPending: false, error: mockSaveError }),
}));

beforeEach(() => {
  mockPush.mockClear();
  mockMutate.mockReset();
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
    expect(mockMutate).toHaveBeenCalledWith(
      { id: null, draft: { name: 'Jo Juniper', handle: '@Jo.Home', bio: '', isPublic: true, sharesRankings: false } },
      expect.anything()
    );
  });

  test('showing the drinks you’ve had is off until you turn it on, and only offered on a public profile', async () => {
    mockProfile = { id: 'p1', handle: 'jo.home', displayName: 'Jo', bio: null, isPublic: true, sharesRankings: false, isModerated: false };
    await renderWithTamagui(<MyProfileScreen />);
    expect(screen.getByRole('radio', { name: 'Keep private', checked: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Show on my profile' }));
    expect(screen.getByText(/People signed in to the app see every drink you’ve ranked/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(mockMutate).toHaveBeenCalledWith({ id: 'p1', draft: { name: 'Jo', handle: 'jo.home', bio: '', isPublic: true, sharesRankings: true } }, expect.anything());

    // A private profile shows nothing, so there's nothing to choose.
    await fireEvent.press(screen.getByRole('radio', { name: 'Only me' }));
    expect(screen.queryByRole('radio', { name: 'Show on my profile' })).toBeNull();
  });

  test('a bad handle is caught before saving', async () => {
    await renderWithTamagui(<MyProfileScreen />);
    await fireEvent.changeText(screen.getByLabelText('Handle'), 'a');
    await fireEvent.press(screen.getByRole('button', { name: 'Make my profile' }));
    expect(screen.getByText(/Use 3 to 30 letters/)).toBeTruthy();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  test('an existing profile edits in place, can go private, and shows the server’s words', async () => {
    mockProfile = { id: 'p1', handle: 'jo.home', displayName: 'Jo', bio: null, isPublic: true, sharesRankings: false, isModerated: false };
    mockSaveError = new Error('That handle is taken. Try another.');
    await renderWithTamagui(<MyProfileScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Only me' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(mockMutate).toHaveBeenCalledWith({ id: 'p1', draft: { name: 'Jo', handle: 'jo.home', bio: '', isPublic: false, sharesRankings: false } }, expect.anything());
    expect(screen.getByText('That handle is taken. Try another.')).toBeTruthy();
  });
});
