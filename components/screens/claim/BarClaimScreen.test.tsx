import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { BarClaimScreen } from './BarClaimScreen';

const mockStart = jest.fn();
const mockWithdraw = jest.fn();
let mockEmail = 'jo@palemoth.com';
let mockClaims: object[] = [];
let mockVenues: { id: string; name: string; roleLevel: number }[] = [];

const page = {
  id: 'p1',
  kind: 'bar',
  handle: 'pale.moth',
  display_name: 'Pale Moth',
  avatar_url: null,
  website: 'https://www.palemoth.com/',
  instagram: 'palemoth',
  social_links: null,
  bar_id: null,
  is_claimed: false,
  is_closed: false,
};

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false }) }));
jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', email: mockEmail, email_confirmed_at: '2026-10-01' } }) }));
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ venues: mockVenues }) }));
jest.mock('@/hooks/useProfiles', () => ({
  useProfile: () => ({ data: page, isLoading: false, error: null }),
  useMyClaims: () => ({ data: mockClaims, isLoading: false }),
}));
jest.mock('@/hooks/useBarClaims', () => ({
  useStartBarClaim: () => ({ mutate: mockStart, reset: jest.fn(), isPending: false, error: null }),
  useWithdrawClaim: () => ({ mutate: mockWithdraw, isPending: false, error: null }),
}));

const claim = (fields: object) => ({ id: 'c1', profile_id: 'p1', user_id: 'me', bar_id: null, message: null, created_at: '2026-10-07T12:00:00Z', code: null, evidence: null, decline_reason: null, ...fields });

beforeEach(() => {
  mockEmail = 'jo@palemoth.com';
  mockClaims = [];
  mockVenues = [];
  mockStart.mockReset();
  mockWithdraw.mockReset();
});

test('a work email at the bar’s own site claims it on the spot', async () => {
  await renderWithTamagui(<BarClaimScreen profileRef="pale.moth" />);
  expect(screen.getByText('How we check')).toBeTruthy();
  expect(screen.getByRole('radio', { name: /Work email \(instant\)/ })).toBeChecked();
  await fireEvent.press(screen.getByRole('button', { name: 'Claim Pale Moth' }));
  expect(mockStart).toHaveBeenCalledWith({ profileId: 'p1', method: 'email', barId: null, note: '' });
});

test('an email elsewhere can’t be used, so Instagram is picked and asks for a code', async () => {
  mockEmail = 'jo@gmail.com';
  await renderWithTamagui(<BarClaimScreen profileRef="pale.moth" />);
  expect(screen.getByRole('radio', { name: /Work email/ })).toBeDisabled();
  expect(screen.getByText(/signed in with an address at gmail.com, not palemoth.com/)).toBeTruthy();
  expect(screen.getByRole('radio', { name: /Instagram bio/ })).toBeChecked();
  await fireEvent.press(screen.getByRole('radio', { name: /A call to the bar/ }));
  await fireEvent.changeText(screen.getByLabelText('Who should we ask for, and when?'), 'Sam, after 4pm');
  await fireEvent.press(screen.getByRole('button', { name: 'Get my code' }));
  expect(mockStart).toHaveBeenCalledWith({ profileId: 'p1', method: 'phone', barId: null, note: 'Sam, after 4pm' });
});

test('an Admin can link a venue they run instead of making one', async () => {
  mockVenues = [{ id: 'v1', name: 'Little Rye', roleLevel: 40 }, { id: 'v2', name: 'Not mine', roleLevel: 30 }];
  await renderWithTamagui(<BarClaimScreen profileRef="pale.moth" />);
  expect(screen.queryByText('Not mine')).toBeNull();
  await fireEvent.press(screen.getByText('Little Rye'));
  await fireEvent.press(screen.getByRole('button', { name: 'Claim Pale Moth' }));
  expect(mockStart).toHaveBeenCalledWith(expect.objectContaining({ barId: 'v1' }));
});

test('a turned-down claim shows the moderator’s reason and lets them try again', async () => {
  mockClaims = [claim({ status: 'rejected', method: 'instagram', decline_reason: 'The bio code was missing.' })];
  await renderWithTamagui(<BarClaimScreen profileRef="pale.moth" />);
  expect(screen.getByText('Your last claim wasn’t approved')).toBeTruthy();
  expect(screen.getByText('The bio code was missing.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Claim Pale Moth' })).toBeTruthy();
});

test('a pending Instagram claim shows its code and can be withdrawn', async () => {
  mockClaims = [claim({ status: 'pending', method: 'instagram', code: '482913', evidence: { instagram: 'palemoth' } })];
  await renderWithTamagui(<BarClaimScreen profileRef="pale.moth" />);
  expect(screen.getByText('Put this code in your bio')).toBeTruthy();
  expect(screen.getByText('482 913')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Withdraw claim' }));
  expect(mockWithdraw).toHaveBeenCalledWith('c1');
});

test('an approved claim says the page is theirs and starts Locked', async () => {
  mockClaims = [claim({ status: 'approved', method: 'email' })];
  await renderWithTamagui(<BarClaimScreen profileRef="pale.moth" />);
  expect(screen.getByText('Pale Moth is yours')).toBeTruthy();
  expect(screen.getByText(/starts Locked/)).toBeTruthy();
});
