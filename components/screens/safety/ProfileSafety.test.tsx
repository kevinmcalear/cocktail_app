import { fireEvent, screen } from '@testing-library/react-native';

import type { Profile } from '@/hooks/useProfiles';
import { renderWithTamagui } from '@/jest.setup';

import { ProfileSafety } from './ProfileSafety';

const mockToggle = jest.fn();
const [mockPush, mockSetParams] = [jest.fn(), jest.fn()];
let mockHidden = false;
let mockClaims: { status: string }[] = [];
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, setParams: mockSetParams }) }));
jest.mock('@/hooks/useProfiles', () => ({
  isUnclaimed: (p: { is_claimed?: boolean }) => !p.is_claimed,
  useMyClaims: () => ({ data: mockClaims }),
  useMyPersonClaim: () => ({ data: null, isPending: false }),
}));
jest.mock('@/ctx/AuthContext', () => jest.requireActual('@/jest.authMock').mockAuthContext(() => ({ user: { id: 'me' } })));
jest.mock('@/hooks/useSafety', () => ({
  useProfileUserId: () => ({ data: 'them' }),
  useSetBlocked: () => ({ mutate: jest.fn(), isPending: false, error: null }),
  useMyBlocks: () => ({ data: [] }),
}));
jest.mock('../kept/useHideBarToggle', () => ({ useHideBarToggle: () => ({ hidden: mockHidden, toggle: mockToggle }) }));

const bar = { id: 'b1', kind: 'bar', handle: 'little-rye', display_name: 'Little Rye', is_public: true, is_claimed: true } as unknown as Profile;

beforeEach(() => {
  for (const m of [mockToggle, mockPush, mockSetParams]) m.mockClear();
  mockHidden = false;
  mockClaims = [];
});

test("a bar's More holds Hide from Discover, rather than a button of its own", async () => {
  await renderWithTamagui(<ProfileSafety profile={bar} />);
  await fireEvent.press(screen.getByRole('button', { name: 'More for @little-rye: claim, hide from Discover, report' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Hide from Discover' }));
  expect(mockToggle).toHaveBeenCalledTimes(1);
});

test('a hidden bar offers to show it again', async () => {
  mockHidden = true;
  await renderWithTamagui(<ProfileSafety profile={bar} />);
  await fireEvent.press(screen.getByRole('button', { name: /^More for @little-rye: claim, show in Discover/ }));
  expect(screen.getByRole('button', { name: 'Show in Discover' })).toBeTruthy();
});

test("a person's More has no Hide", async () => {
  await renderWithTamagui(<ProfileSafety profile={{ ...bar, kind: 'person', handle: 'jo' }} />);
  await fireEvent.press(screen.getByRole('button', { name: 'More for @jo: report, block' }));
  expect(screen.queryByRole('button', { name: 'Hide from Discover' })).toBeNull();
});

test("Q33: an unclaimed bar's More leads with Is this your bar? and Worked here?", async () => {
  await renderWithTamagui(<ProfileSafety profile={{ ...bar, is_claimed: false } as unknown as Profile} />);
  await fireEvent.press(screen.getByRole('button', { name: /^More for @little-rye: claim/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Worked here? Find your name in its credits' }));
  expect(mockSetParams).toHaveBeenCalledWith({ tab: 'people' });
  await fireEvent.press(screen.getByRole('button', { name: /^More for @little-rye: claim/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Is this your bar? Claim Little Rye and set it up' }));
  expect(mockPush).toHaveBeenCalledWith('/venue-setup?claim=b1');
});

test("Q33: an unclaimed person's More asks Is this you?, which opens the claim sheet; not once a claim is sent", async () => {
  const ash = { ...bar, kind: 'person', handle: 'ash', display_name: 'Ash Okafor', is_claimed: false } as unknown as Profile;
  await renderWithTamagui(<ProfileSafety profile={ash} />);
  await fireEvent.press(screen.getByRole('button', { name: 'More for @ash: claim, report, block' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Is this you? Claim Ash Okafor’s page and the drinks credited to it' }));
  expect(mockSetParams).toHaveBeenCalledWith({ claim: '1' });
  mockClaims = [{ status: 'pending' }];
  await renderWithTamagui(<ProfileSafety profile={ash} />);
  expect(screen.getByRole('button', { name: 'More for @ash: report, block' })).toBeTruthy();
});
