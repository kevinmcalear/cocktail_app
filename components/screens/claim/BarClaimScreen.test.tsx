import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { BarClaimScreen } from './BarClaimScreen';

const mockStart = jest.fn();
const mockWithdraw = jest.fn();
let mockEmail = 'jo@palemoth.com';
let mockClaims: object[] = [];
let mockVenues: { id: string; name: string; roleLevel: number }[] = [];
let mockPhone: string | null = '(03) 9000 0000';

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
let mockPage: typeof page = page;

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false }) }));
jest.mock('@/ctx/AuthContext', () => jest.requireActual('@/jest.authMock').mockAuthContext(() => ({ user: { id: 'me', email: mockEmail, email_confirmed_at: '2026-10-01' } })));
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ venues: mockVenues }) }));
jest.mock('@/hooks/useProfiles', () => ({
  useProfile: () => ({ data: mockPage, isLoading: false, error: null }),
  useMyClaims: () => ({ data: mockClaims, isLoading: false }),
}));
jest.mock('@/hooks/useBarFacts', () => ({ useBarFacts: () => ({ data: { phone: mockPhone } }) }));
jest.mock('@/hooks/useBarClaims', () => ({
  useStartBarClaim: () => ({ mutate: mockStart, reset: jest.fn(), isPending: false, error: null }),
  useWithdrawClaim: () => ({ mutate: mockWithdraw, isPending: false, error: null }),
}));

const claim = (fields: object) => ({ id: 'c1', profile_id: 'p1', user_id: 'me', bar_id: null, message: null, created_at: '2026-10-07T12:00:00Z', code: null, evidence: null, decline_reason: null, ...fields });

beforeEach(() => {
  mockEmail = 'jo@palemoth.com';
  mockClaims = [];
  mockVenues = [];
  mockPhone = '(03) 9000 0000';
  mockPage = page;
  mockStart.mockReset();
  mockWithdraw.mockReset();
});

test('a work email at the bar’s own site claims it on the spot', async () => {
  await renderWithTamagui(<BarClaimScreen profileRef="pale.moth" />);
  expect(screen.getByText('Prove it’s yours')).toBeTruthy();
  expect(screen.getByRole('radio', { name: /^Work email/ })).toBeChecked();
  expect(screen.getByText('Instant')).toBeTruthy();
  expect(screen.getByText(/Up to 3 claims a day/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Claim Pale Moth' }));
  expect(mockStart).toHaveBeenCalledWith(expect.objectContaining({ profileId: 'p1', method: 'email', barId: null, note: '' }));
});

test('an email elsewhere can’t be used, so Instagram is picked and shows the code before sending', async () => {
  mockEmail = 'jo@gmail.com';
  await renderWithTamagui(<BarClaimScreen profileRef="pale.moth" />);
  expect(screen.getByRole('radio', { name: /^Work email/ })).toBeDisabled();
  expect(screen.getByText(/signed in with an address at gmail.com, not palemoth.com/)).toBeTruthy();
  expect(screen.getByRole('radio', { name: /message from the bar’s Instagram/ })).toBeChecked();
  const code = screen.getByLabelText(/^Your code: /).props.accessibilityLabel.replace(/\D/g, '');
  expect(code).toMatch(/^[0-9]{6}$/);
  expect(screen.getByRole('button', { name: 'Open Instagram' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('radio', { name: /A call to the bar/ }));
  expect(screen.getByText('Slowest')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Send claim' }));
  expect(mockStart).toHaveBeenCalledWith({ profileId: 'p1', method: 'phone', barId: null, note: '', code, typed: {} });
});

test('a page with no Instagram, website or phone asks for the one each way needs', async () => {
  mockPage = { ...page, website: null as unknown as string, instagram: null as unknown as string };
  mockPhone = null;
  mockEmail = 'ana@harbourroom.com';
  await renderWithTamagui(<BarClaimScreen profileRef="pale.moth" />);
  expect(screen.getByRole('radio', { name: /message from the bar’s Instagram/ })).toBeChecked();
  expect(screen.getByText('Add the bar’s phone number to use this.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Send claim' })).toBeDisabled();
  expect(screen.queryByLabelText(/^Your code: /)).toBeNull();

  await fireEvent.changeText(screen.getByLabelText('The bar’s Instagram'), '@HarbourRoom');
  expect(screen.getByText(/in a message from @harbourroom. A person checks it’s Pale Moth’s own account/)).toBeTruthy();
  expect(screen.getByLabelText(/^Your code: /)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Send claim' }));
  expect(mockStart).toHaveBeenCalledWith(expect.objectContaining({ method: 'instagram', typed: { instagram: '@HarbourRoom' } }));

  // A website they type is never instant, even when it matches.
  await fireEvent.press(screen.getByRole('radio', { name: /^Work email/ }));
  await fireEvent.changeText(screen.getByLabelText('The bar’s website'), 'harbourroom.com');
  expect(screen.getByText(/A person checks the site is the bar’s, because you added it/)).toBeTruthy();
  expect(screen.queryByText('Instant')).toBeNull();
  expect(screen.getByRole('button', { name: 'Send claim' })).toBeEnabled();
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

test('an approved claim says the page is theirs and starts at Menu', async () => {
  mockClaims = [claim({ status: 'approved', method: 'email' })];
  await renderWithTamagui(<BarClaimScreen profileRef="pale.moth" />);
  expect(screen.getByText('Pale Moth is yours')).toBeTruthy();
  expect(screen.getByText(/starts at Menu/)).toBeTruthy();
});
