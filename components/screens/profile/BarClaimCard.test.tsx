import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';
import type { Profile } from '@/hooks/useProfiles';

import { BarClaimCard, ClaimLine } from './BarClaimCard';

const [mockPush, mockBack, mockDismissTo] = [jest.fn(), jest.fn(), jest.fn()];
let mockParams: { owner?: string } = {};
let mockClaims: { status: string }[] = [];
let mockMeta: { onboarded?: boolean } = {};
let mockPerson: { id: string } | null = null;
let mockVenues: { id: string }[] = [];
let mockOthersWaiting = false;
let mockAsked: { declined_at: string | null } | null = null;
const mockAsk = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, dismissTo: mockDismissTo, canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', user_metadata: mockMeta } }) }));
jest.mock('@/hooks/useProfiles', () => ({
  isUnclaimed: (p: { is_claimed: boolean }) => !p.is_claimed,
  useMyClaims: () => ({ data: mockClaims }),
  useMyPersonClaim: () => ({ data: mockPerson, isPending: false }),
}));
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ venues: mockVenues }) }));
jest.mock('@/hooks/useBarClaims', () => ({ useClaimPending: () => ({ data: mockOthersWaiting }) }));
jest.mock('@/hooks/useJoinRequests', () => ({
  useMyJoinRequest: () => ({ data: mockAsked }),
  useAskToJoin: () => ({ mutate: mockAsk, isPending: false, error: null }),
}));

const rye = { id: 'lr', display_name: 'Little Rye', is_claimed: false } as unknown as Profile;

beforeEach(() => {
  [mockParams, mockClaims, mockMeta, mockPerson, mockVenues, mockOthersWaiting, mockAsked] = [{}, [], {}, null, [], false, null];
  for (const m of [mockPush, mockBack, mockDismissTo, mockAsk]) m.mockReset();
});

test('from Setup’s Find your bar: the full card; Claim goes back to Setup with the bar, Not mine back to the search', async () => {
  [mockParams, mockMeta] = [{ owner: '1' }, { onboarded: false }];
  await renderWithProviders(<BarClaimCard profile={rye} />);
  expect(screen.getByText('Is this your bar?')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Claim Little Rye' }));
  expect(mockDismissTo).toHaveBeenCalledWith('/onboarding?run=lr');
  await fireEvent.press(screen.getByRole('button', { name: 'Not mine' }));
  expect(mockBack).toHaveBeenCalled();
});

test('everyone else: nothing under the name (Q33: the claim is in More and at the end)', async () => {
  await renderWithProviders(<BarClaimCard profile={rye} />);
  expect(screen.queryByText(/your bar/)).toBeNull();
});

test('the end line: Claim this page runs venue setup, Find your name opens People', async () => {
  const onFind = jest.fn();
  await renderWithProviders(<ClaimLine profile={rye} onFind={onFind} />);
  expect(screen.getByText('Run Little Rye or work there?')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Claim this page'));
  expect(mockPush).toHaveBeenCalledWith('/venue-setup?claim=lr');
  await fireEvent.press(screen.getByLabelText('Find your name'));
  expect(onFind).toHaveBeenCalled();
});

test('the end line: a claimed bar has the staff door instead of the claim; its team sees none', async () => {
  const claimed = { ...rye, is_claimed: true, bar_id: 'v1' } as unknown as Profile;
  await renderWithProviders(<ClaimLine profile={claimed} onFind={jest.fn()} />);
  expect(screen.getByText('Work here?')).toBeTruthy();
  expect(screen.queryByLabelText('Claim this page')).toBeNull();
  expect(screen.getByLabelText('Find your name')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Ask to join'));
  expect(mockAsk).toHaveBeenCalledWith('lr');
  mockAsked = { declined_at: null };
  await renderWithProviders(<ClaimLine profile={claimed} />);
  expect(screen.getByText('You asked to join.')).toBeTruthy();
  mockVenues = [{ id: 'v1' }];
  await renderWithProviders(<ClaimLine profile={claimed} onFind={jest.fn()} />);
  expect(screen.queryByText('Work here?')).toBeNull();
});

test('the end line: someone else’s waiting claim is noted and the claim stays open', async () => {
  mockOthersWaiting = true;
  await renderWithProviders(<ClaimLine profile={rye} />);
  expect(screen.getByText('(a claim is waiting)')).toBeTruthy();
  expect(screen.getByLabelText('Claim this page')).toBeTruthy();
});

test('a claim sent says so', async () => {
  mockClaims = [{ status: 'pending' }];
  await renderWithProviders(<BarClaimCard profile={rye} />);
  expect(screen.getByText('Claim sent, waiting for approval.')).toBeTruthy();
});

test('a claimed bar has no claim', async () => {
  await renderWithProviders(<BarClaimCard profile={{ ...rye, is_claimed: true } as Profile} />);
  expect(screen.queryByText(/your bar/)).toBeNull();
});
