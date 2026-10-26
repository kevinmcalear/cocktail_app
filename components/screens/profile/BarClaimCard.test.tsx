import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { Profile } from '@/hooks/useProfiles';

import { BarClaimCard, ClaimLine } from './BarClaimCard';

const [mockPush, mockBack, mockDismissTo] = [jest.fn(), jest.fn(), jest.fn()];
let mockParams: { owner?: string } = {};
let mockClaims: { status: string }[] = [];
let mockMeta: { onboarded?: boolean } = {};
let mockPerson: { id: string } | null = null;
let mockVenues: { id: string }[] = [];

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

const rye = { id: 'lr', display_name: 'Little Rye', is_claimed: false } as unknown as Profile;

beforeEach(() => {
  [mockParams, mockClaims, mockMeta, mockPerson, mockVenues] = [{}, [], {}, null, []];
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

test('everyone else: nothing under the name (Q33: the claim is in More and at the end)', async () => {
  await renderWithTamagui(<BarClaimCard profile={rye} />);
  expect(screen.queryByText(/your bar/)).toBeNull();
});

test('the end line: Claim this page runs venue setup, Find your name opens People', async () => {
  const onFind = jest.fn();
  await renderWithTamagui(<ClaimLine profile={rye} onFind={onFind} />);
  expect(screen.getByText('Run Little Rye or work there?')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Claim this page'));
  expect(mockPush).toHaveBeenCalledWith('/venue-setup?claim=lr');
  await fireEvent.press(screen.getByLabelText('Find your name'));
  expect(onFind).toHaveBeenCalled();
});

test('the end line: a claimed bar asks only who worked there; its team and people with a page see none', async () => {
  const claimed = { ...rye, is_claimed: true, bar_id: 'v1' } as unknown as Profile;
  await renderWithTamagui(<ClaimLine profile={claimed} onFind={jest.fn()} />);
  expect(screen.getByText('Worked at Little Rye?')).toBeTruthy();
  expect(screen.queryByLabelText('Claim this page')).toBeNull();
  mockVenues = [{ id: 'v1' }];
  await renderWithTamagui(<ClaimLine profile={claimed} onFind={jest.fn()} />);
  expect(screen.queryByText('Worked at Little Rye?')).toBeNull();
  [mockVenues, mockPerson] = [[], { id: 'mine' }];
  await renderWithTamagui(<ClaimLine profile={claimed} onFind={jest.fn()} />);
  expect(screen.queryByText('Worked at Little Rye?')).toBeNull();
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
