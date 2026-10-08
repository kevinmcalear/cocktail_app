import { fireEvent, screen } from '@testing-library/react-native';

import { TeamMembers } from '@/components/bar/TeamMembers';
import { renderWithTamagui } from '@/jest.setup';

const mockMutate = jest.fn();
jest.mock('@/hooks/useBarDetail', () => ({
  useSetMemberRole: () => ({ mutate: mockMutate, isPending: false, error: null }),
}));
jest.mock('@/hooks/useBarInvites', () => ({
  useBarInvites: (_barId: string, enabled: boolean) => ({ data: enabled ? [{ id: 'i1', email: 'new@example.test', role_level: 30 }] : [] }),
  useRemoveInvite: () => ({ mutate: mockMutate, isPending: false, error: null }),
}));
jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
jest.mock('@/lib/dialogs', () => ({ confirmAsync: jest.fn(async () => true) }));

// get_bar_members returns emails to admins only (and your own row).
const asAdmin = [
  { user_id: 'me', email: 'me@example.test', role_level: 40 },
  { user_id: 'jo', email: 'jo@example.test', role_level: 20 },
];
const asBartender = [
  { user_id: 'boss', email: null, role_level: 40 },
  { user_id: 'me', email: 'me@example.test', role_level: 30 },
];

beforeEach(() => mockMutate.mockClear());

test('an admin can change other members’ roles and invite people, but not their own role', async () => {
  await renderWithTamagui(<TeamMembers barId="bar" members={asAdmin} myRole={40} />);
  expect(screen.getByLabelText('Role for jo@example.test')).toBeTruthy();
  expect(screen.queryByLabelText('Role for me@example.test')).toBeNull();
  expect(screen.getByText('Invite')).toBeTruthy();
  expect(screen.getByText('new@example.test')).toBeTruthy();

  await fireEvent.press(screen.getAllByText('Bartender')[1]);
  expect(mockMutate).toHaveBeenCalledWith({ email: 'jo@example.test', roleLevel: 30 });
});

test('a bartender sees the team read-only', async () => {
  await renderWithTamagui(<TeamMembers barId="bar" members={asBartender} myRole={30} />);
  expect(screen.queryByRole('radiogroup')).toBeNull();
  expect(screen.queryByText('Invite')).toBeNull();
  expect(screen.queryByText('new@example.test')).toBeNull();
  expect(screen.getByText('Admin')).toBeTruthy();
  expect(screen.getByText('me@example.test (you)')).toBeTruthy();
});
