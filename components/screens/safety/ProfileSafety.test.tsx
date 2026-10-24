import { fireEvent, screen } from '@testing-library/react-native';

import type { Profile } from '@/hooks/useProfiles';
import { renderWithTamagui } from '@/jest.setup';

import { ProfileSafety } from './ProfileSafety';

const mockToggle = jest.fn();
let mockHidden = false;
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/ctx/AuthContext', () => jest.requireActual('@/jest.authMock').mockAuthContext(() => ({ user: { id: 'me' } })));
jest.mock('@/hooks/useSafety', () => ({
  useProfileUserId: () => ({ data: 'them' }),
  useSetBlocked: () => ({ mutate: jest.fn(), isPending: false, error: null }),
  useMyBlocks: () => ({ data: [] }),
}));
jest.mock('../kept/useHideBarToggle', () => ({ useHideBarToggle: () => ({ hidden: mockHidden, toggle: mockToggle }) }));

const bar = { id: 'b1', kind: 'bar', handle: 'little-rye', display_name: 'Little Rye', is_public: true } as Profile;

beforeEach(() => {
  mockToggle.mockClear();
  mockHidden = false;
});

test("a bar's More holds Hide from Discover, rather than a button of its own", async () => {
  await renderWithTamagui(<ProfileSafety profile={bar} />);
  await fireEvent.press(screen.getByRole('button', { name: 'More for @little-rye: hide from Discover, report' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Hide from Discover' }));
  expect(mockToggle).toHaveBeenCalledTimes(1);
});

test('a hidden bar offers to show it again', async () => {
  mockHidden = true;
  await renderWithTamagui(<ProfileSafety profile={bar} />);
  await fireEvent.press(screen.getByRole('button', { name: /^More for @little-rye: show in Discover/ }));
  expect(screen.getByRole('button', { name: 'Show in Discover' })).toBeTruthy();
});

test("a person's More has no Hide", async () => {
  await renderWithTamagui(<ProfileSafety profile={{ ...bar, kind: 'person', handle: 'jo' }} />);
  await fireEvent.press(screen.getByRole('button', { name: 'More for @jo: report, block' }));
  expect(screen.queryByRole('button', { name: 'Hide from Discover' })).toBeNull();
});
