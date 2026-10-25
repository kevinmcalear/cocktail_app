import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { forgetSetupProgress, OnboardingScreen } from './OnboardingScreen';

// The owner's path through Setup (owner-setup steps 1 to 3): what brings you here, find your bar, add it.
const [mockReplace, mockPush, mockSaveName, mockFinish] = [jest.fn(), jest.fn(), jest.fn(), jest.fn()];
let mockMeta: { onboarded?: boolean } = { onboarded: false };
const rye = { id: 'lr', handle: 'little-rye', display_name: 'Little Rye', address_line: '214 Smith St', locality: 'Fitzroy', city: 'Melbourne', bar_type: null, avatar_url: null, is_closed: false, claimed: false, awards: 0, drinks: 12, sample: [] };

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: mockPush, back: jest.fn(), canGoBack: () => false }), useLocalSearchParams: () => ({}) }));
jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', user_metadata: mockMeta }, loading: false }) }));
jest.mock('@/hooks/useBarInvites', () => ({ useMyInvites: () => ({ data: [], isLoading: false }) }));
jest.mock('@/hooks/useMyProfile', () => ({ useMyProfile: () => ({ data: null, isPending: false, error: null, refetch: jest.fn() }) }));
jest.mock('@/hooks/useOnboarding', () => ({
  useSaveOnboardingName: () => ({ mutate: mockSaveName, isPending: false, error: null }),
  useSaveWorkplace: () => ({ mutate: jest.fn(), isPending: false, error: null }),
  useFinishOnboarding: () => ({ mutate: mockFinish, isPending: false, error: null }),
}));
jest.mock('@/hooks/useProfiles', () => ({ useMyPersonClaim: () => ({ data: null }) }));
jest.mock('@/hooks/useVenueSetup', () => ({ useClaimableBars: (term: string) => ({ data: term.trim().length >= 2 ? [rye] : [] }) }));
jest.mock('@/components/screens/home/BarMark', () => ({ BarMark: () => null }));
jest.mock('@/components/screens/home/AddBar', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    AddBarForm: ({ initialName, submitLabel, onAdded }: { initialName: string; submitLabel: string; onAdded: (v: { id: string }) => void }) => (
      <Pressable role="button" accessibilityLabel={submitLabel} onPress={() => onAdded({ id: 'new-page' })}>
        <Text>{`Adding ${initialName}`}</Text>
      </Pressable>
    ),
  };
});

beforeEach(() => {
  mockMeta = { onboarded: false };
  for (const m of [mockReplace, mockPush, mockSaveName, mockFinish]) m.mockReset();
  mockSaveName.mockImplementation((_input, opts) => opts?.onSuccess?.('p1'));
  mockFinish.mockImplementation(() => (mockMeta = { onboarded: true }));
  forgetSetupProgress();
});

test('setting up a bar: find it and open its page, or add it, and venue setup takes over with no career steps, taste or units', async () => {
  await renderWithTamagui(<OnboardingScreen />);
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Jo Juniper');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByText('What brings you here?')).toBeTruthy();
  expect(screen.getByText('Step 2 of 5')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: /I’m setting up a bar/ }));
  expect(screen.getByText('Find your bar')).toBeTruthy();
  expect(screen.getByText('Step 3 of 4')).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText('Bar name or street'), 'Little Rye');
  await fireEvent.press(screen.getByRole('link', { name: /^Little Rye\. Not claimed yet\. 214 Smith St, Fitzroy · on Cocktail, 12 drinks/ }));
  expect(mockPush).toHaveBeenCalledWith('/p/little-rye');

  await fireEvent.press(screen.getByRole('link', { name: /My bar isn’t here/ }));
  expect(screen.getByText('Add your bar')).toBeTruthy();
  expect(screen.getByText('Step 4 of 4')).toBeTruthy();
  expect(screen.getByText('Adding Little Rye')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Set it up' }));
  expect(mockSaveName).toHaveBeenCalledWith({ name: 'Jo Juniper', handle: 'jo.juniper', profileId: null }, expect.anything());
  expect(mockReplace).toHaveBeenCalledWith('/venue-setup?claim=new-page');
});
