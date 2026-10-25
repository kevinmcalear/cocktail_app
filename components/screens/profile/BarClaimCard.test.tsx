import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { Profile } from '@/hooks/useProfiles';

import { BarClaimCard } from './BarClaimCard';

const [mockPush, mockBack, mockDismissTo] = [jest.fn(), jest.fn(), jest.fn()];
let mockParams: { owner?: string } = {};
let mockClaims: { status: string }[] = [];
let mockMeta: { onboarded?: boolean } = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, dismissTo: mockDismissTo, canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', user_metadata: mockMeta } }) }));
jest.mock('@/hooks/useProfiles', () => ({
  isUnclaimed: (p: { is_claimed: boolean }) => !p.is_claimed,
  useMyClaims: () => ({ data: mockClaims }),
}));

const rye = { id: 'lr', display_name: 'Little Rye', is_claimed: false } as unknown as Profile;

beforeEach(() => {
  [mockParams, mockClaims, mockMeta] = [{}, [], {}];
  for (const m of [mockPush, mockBack, mockDismissTo]) m.mockReset();
});

test('from Setup’s Find your bar: the full card; Claim goes back to Setup with the bar, Not mine back to the search', async () => {
  [mockParams, mockMeta] = [{ owner: '1' }, { onboarded: false }];
  await renderWithTamagui(<BarClaimCard profile={rye} />);
  expect(screen.getByText('Is this your bar?')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Claim Little Rye' }));
  expect(mockDismissTo).toHaveBeenCalledWith('/onboarding?run=lr');
  await fireEvent.press(screen.getByRole('button', { name: 'Not mine' }));
  expect(mockBack).toHaveBeenCalled();
});

test('everyone else: one quiet line that runs venue setup for the bar', async () => {
  await renderWithTamagui(<BarClaimCard profile={rye} />);
  expect(screen.queryByRole('button', { name: 'Not mine' })).toBeNull();
  await fireEvent.press(screen.getByLabelText('Claim Little Rye'));
  expect(mockPush).toHaveBeenCalledWith('/venue-setup?claim=lr');
});

test('a claim sent says so', async () => {
  mockClaims = [{ status: 'pending' }];
  await renderWithTamagui(<BarClaimCard profile={rye} />);
  expect(screen.getByText('Your claim is being checked.')).toBeTruthy();
});

test('a claimed bar has no claim', async () => {
  await renderWithTamagui(<BarClaimCard profile={{ ...rye, is_claimed: true } as Profile} />);
  expect(screen.queryByText(/your bar/)).toBeNull();
});
