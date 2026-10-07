import { fireEvent, screen, within } from '@testing-library/react-native';

import { TeamScreen } from '@/components/screens/team/TeamScreen';
import { renderWithTamagui } from '@/jest.setup';

const mockMutate = jest.fn();
const mockRemove = jest.fn();
const mockAdd = jest.fn();
const mockSend = jest.fn();
let mockRole = 40;

jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: jest.fn(), back: jest.fn(), canGoBack: () => false }) }));
jest.mock('@/hooks/useMode', () => ({ useMode: () => ({ mode: 'venue' }) }));
jest.mock('@/hooks/useIsWideWeb', () => ({ useIsWideWeb: () => true }));
jest.mock('@/hooks/useActiveVenue', () => ({
  useActiveVenue: () => ({ active: { id: 'bar', name: 'Caretakers' }, isLoading: false }),
}));
jest.mock('@/hooks/useViewAs', () => ({ useEffectiveRole: () => mockRole }));
jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
jest.mock('@/lib/dialogs', () => ({ confirmAsync: jest.fn(async () => true) }));
jest.mock('@/hooks/useBarDetail', () => ({
  useBarMembers: () => ({
    data: [
      { user_id: 'me', email: 'ada@example.test', role_level: 40, display_name: 'Ada', joined_at: '2026-01-02T00:00:00Z' },
      { user_id: 'jo', email: 'jo@example.test', role_level: 20, display_name: 'Jo', joined_at: '2026-03-04T00:00:00Z' },
    ],
    isLoading: false,
    error: null,
  }),
  // The screen makes two: the first changes roles, the second invites.
  useSetMemberRole: (() => {
    let n = 0;
    return () => ({ mutate: n++ % 2 === 0 ? mockMutate : mockAdd, isPending: false, error: null });
  })(),
  useRemoveMember: () => ({ mutate: mockRemove, isPending: false, error: null }),
}));
jest.mock('@/hooks/useBarInvites', () => ({
  useBarInvites: (_barId: string, enabled: boolean) => ({
    data: enabled ? [{ id: 'i1', email: 'new@example.test', role_level: 30, name: 'Nia' }] : [],
  }),
  useRemoveInvite: () => ({ mutate: mockMutate, isPending: false, error: null }),
  useSendInviteEmail: () => ({ mutate: mockSend, isPending: false, error: null }),
}));

beforeEach(() => {
  mockRole = 40;
  mockMutate.mockClear();
  mockRemove.mockClear();
  mockAdd.mockReset();
  mockSend.mockReset();
});

test('an admin can look someone up, invite, change a role, and remove', async () => {
  await renderWithTamagui(<TeamScreen />);
  expect(screen.getByText('Caretakers')).toBeTruthy();
  expect(screen.getByText('jo@example.test')).toBeTruthy();
  expect(screen.getByText('Joined 4 Mar 2026')).toBeTruthy();
  expect(screen.getByText('Nia, new@example.test · invited as Bartender')).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText('Look up'), 'jo');
  expect(screen.queryByText('Ada (you)')).toBeNull();
  expect(screen.getByText('Jo')).toBeTruthy();

  await fireEvent.press(within(screen.getByLabelText('Role for Jo')).getByRole('radio', { name: 'Bartender' }));
  expect(mockMutate).toHaveBeenCalledWith({ email: 'jo@example.test', roleLevel: 30 });

  await fireEvent.press(screen.getByRole('button', { name: 'Remove' }));
  expect(mockRemove).toHaveBeenCalledWith('jo');
});

test('an admin invites by name and email, and the invite is emailed', async () => {
  mockAdd.mockImplementation((_input, opts) => opts?.onSuccess?.(true));
  await renderWithTamagui(<TeamScreen />);
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Sam Rivera');
  await fireEvent.changeText(screen.getByLabelText('Email'), ' Sam@Example.test ');
  await fireEvent.press(screen.getByRole('button', { name: 'Invite' }));
  expect(mockAdd).toHaveBeenCalledWith({ email: 'sam@example.test', roleLevel: 20, name: 'Sam Rivera' }, expect.anything());
  expect(mockSend).toHaveBeenCalledWith('sam@example.test', expect.anything());

  await fireEvent.press(screen.getByRole('button', { name: 'Email again' }));
  expect(mockSend).toHaveBeenLastCalledWith('new@example.test', expect.anything());
});

test('an employee sees the team and cannot manage it', async () => {
  mockRole = 20;
  await renderWithTamagui(<TeamScreen />);
  expect(screen.getByText('Ada (you)')).toBeTruthy();
  expect(screen.getByText('Jo')).toBeTruthy();
  expect(screen.getByText('Employee')).toBeTruthy();
  expect(screen.getByText('Opens at Admin')).toBeTruthy();
  expect(screen.queryByLabelText('Look up')).toBeNull();
  expect(screen.queryByText('Invite')).toBeNull();
  expect(screen.queryByText('jo@example.test')).toBeNull();
  expect(screen.queryByText('Nia, new@example.test · invited as Bartender')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
});
