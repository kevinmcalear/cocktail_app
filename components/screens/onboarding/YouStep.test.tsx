import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { forgetSetupProgress, OnboardingScreen } from './OnboardingScreen';

// "Is this you?" in Setup (28 Oct 2026): a page that could be theirs comes straight after the name.
const [mockSaveName, mockFinish, mockAuthName] = [jest.fn(), jest.fn(), jest.fn()];
type Page = { id: string; handle: string; display_name: string; city: string | null; is_claimed: boolean };
let mockNamesakes: Page[] = [];
let mockPersonClaim: { id: string; status: 'pending'; profile: { id: string; handle: string; display_name: string } } | null = null;

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false }), useLocalSearchParams: () => ({}) }));
jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', user_metadata: { onboarded: false } }, loading: false, updateProfile: mockAuthName }) }));
jest.mock('@/hooks/useBarInvites', () => ({ useMyInvites: () => ({ data: [], isLoading: false }) }));
jest.mock('@/hooks/useLikelyClaimer', () => ({ useSaveSetupAnswer: () => ({ mutate: jest.fn() }) }));
jest.mock('@/hooks/useMyProfile', () => ({ useMyProfile: () => ({ data: null, isPending: false, error: null, refetch: jest.fn() }) }));
jest.mock('@/hooks/useOnboarding', () => ({
  useSaveOnboardingName: () => ({ mutate: mockSaveName, isPending: false, error: null }),
  useSaveWorkplace: () => ({ mutate: jest.fn(), isPending: false, error: null }),
  useFinishOnboarding: () => ({ mutate: mockFinish, isPending: false, error: null }),
}));
jest.mock('@/hooks/useFlavor', () => ({ useSaveTasteAnswers: () => ({ mutate: jest.fn(), isPending: false, error: null }) }));
jest.mock('@/hooks/useProfiles', () => ({
  useFindNamesakes: () => async () => mockNamesakes,
  useNamesakes: () => ({ data: mockNamesakes }),
  useWaiting: () => ({ data: {} }),
  useMyPersonClaim: () => ({ data: mockPersonClaim, isSuccess: true }),
  useProfile: () => ({ data: null }),
}));
jest.mock('@/lib/claimReturn', () => ({ useClaimReturn: () => {} }));

const mathew: Page = { id: 'mr', handle: 'mathew.resler', display_name: 'Mathew Resler', city: 'New York', is_claimed: false };

beforeEach(() => {
  for (const m of [mockSaveName, mockFinish, mockAuthName]) m.mockReset();
  mockAuthName.mockResolvedValue({ error: null });
  [mockNamesakes, mockPersonClaim] = [[], null];
  forgetSetupProgress();
});

async function named(name = 'Matt Resler') {
  await renderWithTamagui(<OnboardingScreen />);
  await fireEvent.changeText(screen.getByLabelText('Name'), name);
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await act(async () => {}); // The look for a page that could be theirs.
}

test('the name is kept on the account, and a page that could be theirs comes next', async () => {
  mockNamesakes = [mathew];
  await named();
  expect(mockAuthName).toHaveBeenCalledWith({ firstName: 'Matt', lastName: 'Resler', fullName: 'Matt Resler' });
  expect(screen.getByText('Is this you?')).toBeTruthy();
  expect(screen.getByText('We already have a page for Mathew Resler, with the bars and drinks we found.')).toBeTruthy();
  expect(screen.getByText('Mathew Resler')).toBeTruthy();
  // Not them: on as usual.
  await fireEvent.press(screen.getByRole('button', { name: 'That’s not me' }));
  expect(screen.getByText('What brings you here?')).toBeTruthy();
});

test('nobody it could be: straight to What brings you here?', async () => {
  await named('Jo Juniper');
  expect(screen.queryByText('Is this you?')).toBeNull();
  expect(screen.getByText('What brings you here?')).toBeTruthy();
});

test('after Claim sent, no path makes a second profile', async () => {
  mockNamesakes = [mathew];
  mockPersonClaim = { id: 'c1', status: 'pending', profile: { id: 'mr', handle: 'mathew.resler', display_name: 'Mathew Resler' } };
  await named();
  expect(screen.getByText('Claim sent')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Keep going' }));
  // Making drinks skips Find (they've seen Claim sent) and the career steps.
  await fireEvent.press(screen.getByRole('button', { name: 'I make drinks at a bar' }));
  expect(screen.getByText('What do you like to drink?')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  await fireEvent.press(screen.getByRole('button', { name: 'I love drinks' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
  expect(mockSaveName).not.toHaveBeenCalled();
});
