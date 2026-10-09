import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { MyProfile } from '@/hooks/useMyProfile';

import { MyProfileScreen } from './MyProfileScreen';

const mockPush = jest.fn();
const mockMutate = jest.fn();
const mockSaveSharing = jest.fn();
let mockProfile: MyProfile | null = null;
let mockSaveError: Error | null = null;

jest.mock('./JobRequests', () => ({ JobRequests: () => null, MyJobRequests: () => null }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => true }) }));
jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', user_metadata: { full_name: 'Jo Juniper' } }, loading: false }) }));
jest.mock('./PastJobs', () => ({ PastJobs: () => null }));
jest.mock('../onboarding/CareerSteps', () => ({ PlaceStep: () => null }));
jest.mock('@/hooks/useProfiles', () => ({ useProfilePositions: () => ({ data: [] }) }));
jest.mock('@/hooks/useMyProfile', () => ({
  useMyProfile: () => ({ data: mockProfile, isPending: false, error: null }),
  useSaveMyProfile: () => ({ mutate: mockMutate, isPending: false, error: mockSaveError }),
  useSaveSharing: () => ({ mutate: mockSaveSharing, isPending: false, error: null }),
}));

beforeEach(() => {
  mockPush.mockClear();
  mockMutate.mockReset();
  mockSaveSharing.mockReset();
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
      { id: null, draft: { name: 'Jo Juniper', handle: '@Jo.Home', bio: '', instagram: '', isPublic: true, tagline: '', headlinePositionId: null, showsPhoto: true } },
      expect.anything()
    );
  });

  test('each section shows All, Picked or None, saved straight away', async () => {
    mockProfile = { id: 'p1', handle: 'jo.home', displayName: 'Jo', bio: null, instagram: null, isPublic: true, sharing: { had: 'picked', bars: 'none', originals: 'all' }, showsDates: false, isModerated: false, tagline: null, headlinePositionId: null, showsPhoto: true };
    await renderWithTamagui(<MyProfileScreen />);
    // Had, Bars, Made in order, each its own All / Picked / None.
    expect(screen.getAllByRole('radio', { name: 'Picked', checked: true })).toHaveLength(1);
    expect(screen.getAllByRole('radio', { name: 'None', checked: true })).toHaveLength(1);
    expect(screen.getByText(/^Only the ones you pick show/)).toBeTruthy();
    expect(screen.getByText(/Credits still show on each drink’s own page/)).toBeTruthy();
    await fireEvent.press(screen.getAllByRole('radio', { name: 'All' })[0]);
    expect(mockSaveSharing).toHaveBeenCalledWith({ id: 'p1', section: 'had', mode: 'all' });
    await fireEvent(screen.getByRole('switch', { name: 'Say when I had them' }), 'valueChange', true);
    expect(mockSaveSharing).toHaveBeenCalledWith({ id: 'p1', showsDates: true });
    await fireEvent.press(screen.getAllByRole('button', { name: 'Choose' })[0]);
    expect(mockPush).toHaveBeenCalledWith('/settings/profile-picks?section=had');
  });

  test('a private profile shows nothing, so there is nothing to choose', async () => {
    mockProfile = { id: 'p1', handle: 'jo.home', displayName: 'Jo', bio: null, instagram: null, isPublic: false, sharing: { had: 'picked', bars: 'picked', originals: 'all' }, showsDates: false, isModerated: false, tagline: null, headlinePositionId: null, showsPhoto: true };
    await renderWithTamagui(<MyProfileScreen />);
    expect(screen.queryByText('What your profile shows')).toBeNull();
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
    mockProfile = { id: 'p1', handle: 'jo.home', displayName: 'Jo', bio: null, instagram: null, isPublic: true, sharing: { had: 'none', bars: 'none', originals: 'all' }, showsDates: false, isModerated: false, tagline: null, headlinePositionId: null, showsPhoto: true };
    mockSaveError = new Error('That handle is taken. Try another.');
    await renderWithTamagui(<MyProfileScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Only me' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(mockMutate).toHaveBeenCalledWith({ id: 'p1', draft: { name: 'Jo', handle: 'jo.home', bio: '', instagram: '', isPublic: false, tagline: '', headlinePositionId: null, showsPhoto: true } }, expect.anything());
    expect(screen.getByText('That handle is taken. Try another.')).toBeTruthy();
  });

  test('the line under your name: nothing by default, a ready-made one, or your own words', async () => {
    mockProfile = { id: 'p1', handle: 'jo.home', displayName: 'Jo', bio: null, instagram: null, isPublic: true, sharing: { had: 'none', bars: 'none', originals: 'all' }, showsDates: false, isModerated: false, tagline: null, headlinePositionId: null, showsPhoto: true };
    await renderWithTamagui(<MyProfileScreen />);
    expect(screen.getByRole('radio', { name: 'Nothing', checked: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Home bartender' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'In my own words' }));
    await fireEvent.changeText(screen.getByLabelText('In your own words'), 'Makes drinks for friends');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(mockMutate.mock.calls[0][0].draft).toMatchObject({ tagline: 'Makes drinks for friends', headlinePositionId: null, showsPhoto: true });
  });
});
