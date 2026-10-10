import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { useAppMode } from '@/store/useAppMode';
import { useSettingsStore } from '@/store/useSettingsStore';

import { OnboardingScreen } from './OnboardingScreen';

const mockReplace = jest.fn();
const mockSaveName = jest.fn();
const mockSaveWork = jest.fn();
const mockCreateBar = jest.fn();
const mockFinish = jest.fn();
const mockClaim = jest.fn();
const mockSaveMenu = jest.fn();
const mockSaveDrink = jest.fn();
const mockAccept = jest.fn();
const mockDecline = jest.fn();
const mockSaveTaste = jest.fn();
let mockMeta: { onboarded?: boolean } = { onboarded: false };
let mockInvitedAt: string | undefined;
type Invite = { id: string; bar_id: string; bar_name: string; bar_slug: string; bar_logo_url: null; bar_color: string | null; bar_display_face: null; bar_ground_tint: null; bar_profile_id: string | null; role_level: number; name: string | null; invited_by_name: string | null };
let mockInvites: Invite[] = [];
const caretakers: Invite = { id: 'i1', bar_id: 'venue', bar_name: 'Caretakers', bar_slug: 'caretakers', bar_logo_url: null, bar_color: '#D0643B', bar_display_face: null, bar_ground_tint: null, bar_profile_id: 'bp', role_level: 30, name: 'Sam Rivera', invited_by_name: 'Ada' };
let mockPeople: { id: string; handle: string; display_name: string; city: string | null; is_claimed: boolean }[] = [];
let mockBars: { id: string; display_name: string; locality: string | null; postcode: null; city: string; country_code: string; is_closed?: boolean }[] = [];

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn(), canGoBack: () => false }) }));
jest.mock('@/ctx/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me', user_metadata: mockMeta, invited_at: mockInvitedAt }, loading: false }),
}));
jest.mock('@/hooks/useBarInvites', () => ({
  useMyInvites: () => ({ data: mockInvites, isLoading: false }),
  useAcceptInvite: () => ({ mutate: mockAccept, isPending: false, error: null }),
  useRemoveInvite: () => ({ mutate: mockDecline, isPending: false, error: null }),
}));
jest.mock('@/hooks/useMyProfile', () => ({ useMyProfile: () => ({ data: null, isPending: false, error: null, refetch: jest.fn() }) }));
jest.mock('@/hooks/useOnboarding', () => ({
  useSaveOnboardingName: () => ({ mutate: mockSaveName, isPending: false, error: null }),
  useSaveWorkplace: () => ({ mutate: mockSaveWork, isPending: false, error: null }),
  useCreateOnboardingBar: () => ({ mutate: mockCreateBar, isPending: false, error: null }),
  useSaveWorkedMenu: () => ({ mutate: mockSaveMenu, isPending: false, error: null }),
  useSaveCareerDrink: () => ({ mutate: mockSaveDrink, isPending: false, error: null }),
  useFinishOnboarding: () => ({ mutate: mockFinish, isPending: false, error: null }),
}));
jest.mock('@/hooks/useFlavor', () => ({
  useSaveTasteAnswers: () => ({ mutate: mockSaveTaste, isPending: false, error: null }),
}));
jest.mock('@/hooks/useProfiles', () => ({
  usePublicPeople: (term: string) => ({ data: term.trim().length >= 2 ? mockPeople : [] }),
  useClaimProfile: () => ({ mutate: mockClaim, isPending: false, error: null }),
}));
jest.mock('@/components/screens/profile/PastJobs', () => {
  const { Text } = jest.requireActual('react-native');
  return { CLAIM_PAST_JOBS: 'Past jobs stay hidden', PastJobs: ({ personId }: { personId: string }) => <Text>{`Jobs of ${personId}`}</Text> };
});
jest.mock('@/hooks/useRankings', () => ({
  usePublicBars: (term: string) => ({ data: term.trim().length >= 2 ? mockBars : [] }),
}));

const attaboy = { id: 'b1', display_name: 'Attaboy', locality: 'New York', postcode: null, city: 'New York', country_code: 'US' };

beforeEach(() => {
  mockMeta = { onboarded: false };
  mockInvitedAt = undefined;
  mockInvites = [];
  mockAccept.mockReset();
  mockDecline.mockReset();
  mockPeople = [];
  mockBars = [attaboy];
  mockReplace.mockClear();
  mockSaveName.mockReset();
  mockSaveWork.mockReset();
  mockCreateBar.mockReset();
  mockFinish.mockReset();
  mockClaim.mockReset();
  mockSaveMenu.mockReset();
  mockSaveDrink.mockReset();
  mockSaveTaste.mockReset();
  mockSaveTaste.mockImplementation((_answers, opts) => opts?.onSuccess?.());
  mockSaveName.mockImplementation((_input, opts) => opts?.onSuccess?.('p1'));
  useSettingsStore.setState({ specUnit: 'ml', defaultUnit: 'ml' });
});

async function named() {
  await renderWithTamagui(<OnboardingScreen />);
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Jo Juniper');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
}

async function newCareer() {
  await named();
  await fireEvent.press(screen.getByRole('button', { name: 'Yes, I work in hospitality' }));
  await fireEvent.press(screen.getByRole('button', { name: 'None of these' }));
}

describe('OnboardingScreen', () => {
  test('a name is required, then home bartenders skip the workplace, say what they like and set a unit', async () => {
    await renderWithTamagui(<OnboardingScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Add the name people will see.')).toBeTruthy();
    expect(mockSaveName).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Name'), 'Jo Juniper');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockSaveName).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'I make drinks at home' }));
    expect(mockSaveName).toHaveBeenCalledWith({ name: 'Jo Juniper', handle: 'jo.juniper', profileId: null }, expect.anything());
    expect(screen.queryByText('Where do you work?')).toBeNull();
    expect(screen.getByText('What do you like to drink?')).toBeTruthy();

    // Continue needs an answer; tapping one again clears it.
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    const loveBitter = screen.getAllByRole('radio', { name: 'Love it' })[0];
    await fireEvent.press(loveBitter);
    await fireEvent.press(screen.getAllByRole('radio', { name: 'Not for me' })[4]);
    await fireEvent.press(screen.getAllByRole('radio', { name: 'Sometimes' })[1]);
    await fireEvent.press(screen.getAllByRole('radio', { name: 'Sometimes' })[1]);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockSaveTaste).toHaveBeenCalledWith({ bitter: 0.8, smoky: 0.1 }, expect.anything());
    expect(screen.getByText('How do you measure?')).toBeTruthy();

    await fireEvent.press(screen.getByRole('radio', { name: 'oz' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(useSettingsStore.getState().specUnit).toBe('oz');
    expect(useSettingsStore.getState().defaultUnit).toBe('oz');

    // Last, the chance to bring something in; home cooks are asked about their shelf.
    expect(screen.getByText('What’s on your shelf?')).toBeTruthy();
    expect(mockFinish).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    expect(mockFinish).toHaveBeenCalled();
  });

  test('bringing something in finishes setup and lands on Bring in', async () => {
    mockFinish.mockImplementation(() => {
      mockMeta = { onboarded: true };
    });
    await renderWithTamagui(<OnboardingScreen />);
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Jo Juniper');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await fireEvent.press(screen.getByRole('button', { name: 'I make drinks at home' }));
    for (const [i, name] of ['Love it', 'Love it', 'Love it', 'Love it', 'Love it'].entries()) await fireEvent.press(screen.getAllByRole('radio', { name })[i]);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Paste or type it' }));
    expect(mockFinish).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/bring-in');
  });

  test('hospitality claims an existing profile instead of making one', async () => {
    mockPeople = [{ id: 'existing', handle: 'jo.juniper', display_name: 'Jo Juniper', city: 'London', is_claimed: false }];
    mockClaim.mockImplementation((_input, opts) => opts?.onSuccess?.());
    await named();
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, I work in hospitality' }));
    expect(screen.getByText('Do we already have you?')).toBeTruthy();

    await fireEvent.press(screen.getByRole('radio', { name: 'Jo Juniper, London' }));
    expect(screen.getByText('Past jobs stay hidden')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Send claim' }));
    expect(mockClaim).toHaveBeenCalledWith({ profile_id: 'existing', message: '', bar_id: null }, expect.anything());
    expect(mockSaveName).not.toHaveBeenCalled();
    expect(screen.getByText('What do you like to drink?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    expect(mockSaveTaste).not.toHaveBeenCalled();
    expect(screen.getByText('How do you measure?')).toBeTruthy();
  });

  test('hospitality can pick a bar, including a closed one, or add one', async () => {
    await newCareer();
    expect(screen.getByText('Where do you work?')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Search bars'), 'At');
    await fireEvent.press(screen.getByRole('radio', { name: 'Attaboy, New York' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Add your role, like Bartender.')).toBeTruthy();
    expect(mockSaveWork).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Your role'), 'Bartender');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockSaveWork).toHaveBeenCalledWith({ personId: 'p1', barId: 'b1', title: 'Bartender', isCurrent: true }, expect.anything());
  });

  test('a previous place can be a closed bar, then a menu and a cocktail', async () => {
    mockSaveWork.mockImplementation((_input, opts) => opts?.onSuccess?.());
    mockBars = [{ ...attaboy, display_name: 'Milk & Honey', locality: 'New York', is_closed: true, id: 'closed' }];
    await newCareer();
    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.getByText('Where you’ve worked')).toBeTruthy();
    expect(screen.getByText('Jobs of p1')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Search bars'), 'Mi');
    await fireEvent.press(screen.getByRole('radio', { name: 'Milk & Honey, New York, closed' }));
    await fireEvent.changeText(screen.getByLabelText('Your role'), 'Bartender');
    await fireEvent.press(screen.getByRole('button', { name: 'Add place' }));
    expect(mockSaveWork).toHaveBeenCalledWith({ personId: 'p1', barId: 'closed', title: 'Bartender', isCurrent: false }, expect.anything());

    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Menus you worked on')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Search bars'), 'Mi');
    await fireEvent.press(screen.getByRole('radio', { name: 'Milk & Honey, New York, closed' }));
    await fireEvent.changeText(screen.getByLabelText('Menu name'), 'Opening list');
    await fireEvent.press(screen.getByRole('button', { name: 'Add menu' }));
    expect(mockSaveMenu).toHaveBeenCalledWith({ personId: 'p1', barId: 'closed', name: 'Opening list', year: null }, expect.anything());

    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Cocktails you worked on')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Cocktail'), 'Gold Rush');
    await fireEvent.changeText(screen.getByLabelText('Search bars'), 'Mi');
    await fireEvent.press(screen.getByRole('radio', { name: 'Milk & Honey, New York, closed' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add cocktail' }));
    expect(mockSaveDrink).toHaveBeenCalledWith({ personId: 'p1', barId: 'closed', name: 'Gold Rush' }, expect.anything());
  });

  test('adding a bar creates the venue', async () => {
    mockCreateBar.mockImplementation((_name, opts) => opts?.onSuccess?.());
    await newCareer();
    await fireEvent.press(screen.getByRole('button', { name: 'Add your bar' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add bar' }));
    expect(screen.getByText('Add the bar’s name.')).toBeTruthy();
    expect(mockCreateBar).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Bar name'), 'Little Rye');
    await fireEvent.press(screen.getByRole('button', { name: 'Add bar' }));
    expect(mockCreateBar).toHaveBeenCalledWith('Little Rye', expect.anything());
  });

  test('an invitee accepts, names themselves (no password), picks units, and their job is saved', async () => {
    mockInvitedAt = '2026-10-07T00:00:00Z';
    mockInvites = [caretakers];
    mockAccept.mockImplementation((_v, opts) => opts?.onSuccess?.());
    mockSaveWork.mockImplementation((_input, opts) => opts?.onSettled?.());
    await renderWithTamagui(<OnboardingScreen />);
    expect(screen.getByText('Join Caretakers as a Bartender')).toBeTruthy();
    expect(screen.getByText(/^Ada added you\./)).toBeTruthy();
    expect(screen.getByText('Pick ml or oz')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Accept and start' }));
    expect(useAppMode.getState()).toMatchObject({ venueId: 'venue', mode: 'venue' });

    expect(screen.getByText('Step 1 of 3')).toBeTruthy();
    expect(screen.getByLabelText('Name').props.value).toBe('Sam Rivera');
    expect(screen.queryByLabelText('Password')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockSaveName).toHaveBeenCalledWith({ name: 'Sam Rivera', handle: 'sam.rivera', profileId: null }, expect.anything());
    expect(mockSaveWork).toHaveBeenCalledWith({ personId: 'p1', barId: 'bp', title: 'Bartender' }, expect.anything());

    expect(await screen.findByText('Step 2 of 3')).toBeTruthy();
    expect(screen.queryByText('Do you work in hospitality?')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockFinish).toHaveBeenCalled();
  });

  test('an invitee whose handle is taken gets the handle field on the same step', async () => {
    mockInvites = [caretakers];
    mockAccept.mockImplementation((_v, opts) => opts?.onSuccess?.());
    mockSaveName.mockImplementationOnce((_input, opts) => opts?.onError?.(new Error('That handle is taken. Try another.')));
    await renderWithTamagui(<OnboardingScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Accept and start' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByLabelText('Handle').props.value).toBe('sam.rivera');
    await fireEvent.changeText(screen.getByLabelText('Handle'), 'sam.r');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockSaveName).toHaveBeenLastCalledWith({ name: 'Sam Rivera', handle: 'sam.r', profileId: null }, expect.anything());
  });

  test('declining an invite runs the usual setup', async () => {
    mockInvites = [{ ...caretakers, bar_profile_id: null, role_level: 40, name: null, invited_by_name: null }];
    mockDecline.mockImplementation((_id, opts) => opts?.onSuccess?.());
    await renderWithTamagui(<OnboardingScreen />);
    expect(screen.getByText('Join Caretakers as an Admin')).toBeTruthy();
    expect(screen.getByText(/^Caretakers added you\./)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Not me? Decline' }));
    expect(mockDecline).toHaveBeenCalledWith('i1', expect.anything());
    expect(screen.queryByText(/Step \d of 3/)).toBeNull();
    expect(screen.queryByLabelText('Password')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Jo Juniper');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Do you work in hospitality?')).toBeTruthy();
  });

  test('a finished account leaves setup', async () => {
    mockMeta = { onboarded: true };
    await renderWithTamagui(<OnboardingScreen />);
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });
});
