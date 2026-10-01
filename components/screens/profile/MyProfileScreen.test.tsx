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
      { id: null, draft: { name: 'Jo Juniper', handle: '@Jo.Home', bio: '', instagram: '', isPublic: true } },
      expect.anything()
    );
  });

  test('a bad Instagram name is caught before saving', async () => {
    await renderWithTamagui(<MyProfileScreen />);
    await fireEvent.changeText(screen.getByLabelText('Instagram (optional)'), 'not a name');
    await fireEvent.press(screen.getByRole('button', { name: 'Make my profile' }));
    expect(screen.getByText(/Dots can’t sit/)).toBeTruthy();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  test('a bad handle is caught before saving', async () => {
    await renderWithTamagui(<MyProfileScreen />);
    await fireEvent.changeText(screen.getByLabelText('Handle'), 'a');
    await fireEvent.press(screen.getByRole('button', { name: 'Make my profile' }));
    expect(screen.getByText(/Use 3 to 30 letters/)).toBeTruthy();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  test('an existing profile edits in place, can go private, and shows the server’s words', async () => {
    mockProfile = { id: 'p1', handle: 'jo.home', displayName: 'Jo', bio: null, instagram: null, isPublic: true, isModerated: false };
    mockSaveError = new Error('That handle is taken. Try another.');
    await renderWithTamagui(<MyProfileScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Only me' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(mockMutate).toHaveBeenCalledWith({ id: 'p1', draft: { name: 'Jo', handle: 'jo.home', bio: '', instagram: '', isPublic: false } }, expect.anything());
    expect(screen.getByText('That handle is taken. Try another.')).toBeTruthy();
  });
});
