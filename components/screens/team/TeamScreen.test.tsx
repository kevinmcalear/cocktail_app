import { fireEvent, screen, within } from '@testing-library/react-native';

import { TeamScreen } from '@/components/screens/team/TeamScreen';
import { renderWithTamagui } from '@/jest.setup';
import { useTeamSort } from '@/store/useTeamSort';

const mockMutate = jest.fn();
const mockRemove = jest.fn();
const mockAdd = jest.fn();
const mockSend = jest.fn();
const mockSendAsync = jest.fn();
let mockRole = 40;

jest.mock('@/components/screens/profile/JobRequests', () => ({ JobRequests: () => null, MyJobRequests: () => null }));
jest.mock('./JoinRequests', () => ({ JoinRequests: () => null, ClaimsToConfirm: () => null }));
jest.mock('@/components/maker/MakerCreditRequests', () => ({ MakerCreditRequests: () => null }));
let mockParams: { invite?: string } = {};
jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: jest.fn(), back: jest.fn(), canGoBack: () => false }), useLocalSearchParams: () => mockParams }));
jest.mock('@/hooks/useMode', () => ({ useMode: () => ({ mode: 'venue' }) }));
jest.mock('@/hooks/useIsWideWeb', () => ({ useIsWideWeb: () => true, useWebNavWidth: () => 240 }));
jest.mock('@/hooks/useActiveVenue', () => ({
  useActiveVenue: () => ({ active: { id: 'bar', name: 'Caretakers' }, isLoading: false }),
}));
jest.mock('@/hooks/useViewAs', () => ({ useEffectiveRole: () => mockRole, useCanManageStaff: () => mockRole >= 40 }));
// An Admin isn't limited to their own permissions, so these only matter below Admin.
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ data: ['menu'] }) }));
jest.mock('@/ctx/AuthContext', () => jest.requireActual('@/jest.authMock').mockAuthContext(() => ({ user: { id: 'me' } })));
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
  useSetMemberRole: () => ({ mutate: mockMutate, mutateAsync: mockAdd, isPending: false, error: null }),
  useRemoveMember: () => ({ mutate: mockRemove, isPending: false, error: null }),
}));
const mockChoose = jest.fn();
jest.mock('@/hooks/useVenueRoles', () => ({
  useRoleMatrix: () => ({
    data: [
      { role_id: null, name: null, base_level: 20, ends_at: null, granted: [], revoked: [], capabilities: ['menu'] },
      { role_id: 'bb', name: 'Barback', base_level: 20, ends_at: null, granted: ['prep'], revoked: [], capabilities: ['menu', 'prep'] },
    ],
  }),
  useSetMemberRoleChoice: () => ({ mutate: mockChoose, isPending: false, error: null }),
}));
jest.mock('@/hooks/useBarInvites', () => ({
  useBarInvites: (_barId: string, enabled: boolean) => ({
    data: enabled ? [{ id: 'i1', email: 'new@example.test', role_level: 30, name: 'Nia', created_at: '2026-01-01T00:00:00Z' }] : [],
  }),
  useRemoveInvite: () => ({ mutate: mockMutate, isPending: false, error: null }),
  useSendInviteEmail: () => ({ mutate: mockSend, mutateAsync: mockSendAsync, isPending: false, error: null }),
}));

beforeEach(() => {
  useTeamSort.setState({ sort: 'role' });
  mockRole = 40;
  mockMutate.mockClear();
  mockChoose.mockClear();
  mockRemove.mockClear();
  mockAdd.mockReset();
  mockSend.mockReset();
  mockSendAsync.mockReset();
});

test('an admin can look someone up, then change their role and remove them from their sheet', async () => {
  await renderWithTamagui(<TeamScreen />);
  // The sidebar names the venue.
  expect(screen.queryByText('Caretakers')).toBeNull();
  expect(screen.getByText('Team · 2')).toBeTruthy();
  expect(screen.getByText('jo@example.test')).toBeTruthy();
  expect(screen.getByText('Nia')).toBeTruthy();
  expect(screen.getByText(/^new@example\.test · Invited as Bartender · \d+ months ago$/)).toBeTruthy();
  // Your own row has no sheet: nobody demotes or removes themselves here.
  expect(screen.queryByRole('button', { name: /^Ada, Admin/ })).toBeNull();

  await fireEvent.changeText(screen.getByLabelText('Search the team'), 'jo');
  expect(screen.queryByText('Ada (you)')).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'Jo, Employee. Manage' }));
  expect(screen.getByText('Joined 4 Mar 2026')).toBeTruthy();
  expect(within(screen.getByLabelText('Role for Jo')).getByRole('radio', { name: 'Guest. Sees the menu only' })).toBeTruthy();
  await fireEvent.press(within(screen.getByLabelText('Role for Jo')).getByRole('radio', { name: 'Bartender. Plus prep notes and the staff list' }));
  expect(mockChoose).toHaveBeenCalledWith({ userId: 'jo', choice: { level: 30 } });
  // The venue's own roles sit under the base levels.
  expect(screen.getByText('CARETAKERS’S ROLES')).toBeTruthy();
  await fireEvent.press(within(screen.getByLabelText('Role for Jo')).getByRole('radio', { name: 'Barback. From Employee, plus prep' }));
  expect(mockChoose).toHaveBeenLastCalledWith({ userId: 'jo', choice: { venueRoleId: 'bb' } });

  await fireEvent.press(screen.getByRole('button', { name: 'Remove from Caretakers' }));
  expect(mockRemove).toHaveBeenCalledWith('jo', expect.anything());
});

test('an admin invites by name, email and role from the sheet, and the invite is emailed', async () => {
  mockAdd.mockResolvedValue(true);
  mockSendAsync.mockResolvedValue({ sent: true });
  await renderWithTamagui(<TeamScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Invite someone' }));
  expect(screen.getByText('Invite to Caretakers')).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'Bartender. Plus prep notes and the staff list', checked: true })).toBeTruthy();
  expect(within(screen.getByLabelText('What they can do')).queryByRole('radio', { name: /^Guest/ })).toBeNull();

  await fireEvent.changeText(screen.getByLabelText('Name'), 'Sam Okafor');
  await fireEvent.changeText(screen.getByLabelText('Email'), ' Sam@Example.test ');
  await fireEvent.press(screen.getByRole('radio', { name: 'Drink Creator. Adds and edits drinks and menus' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Email Sam an invite' }));
  expect(mockAdd).toHaveBeenCalledWith({ email: 'sam@example.test', roleLevel: 35, name: 'Sam Okafor' });
  expect(mockSendAsync).toHaveBeenCalledWith('sam@example.test');
  expect(await screen.findByText('Invite emailed to Sam Okafor.')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Email the invite to new@example.test again' }));
  expect(mockSend).toHaveBeenLastCalledWith('new@example.test', expect.anything());
});

test('/team?invite=1 opens on the invite sheet (Invite your team, from the venue sheet or an empty Library)', async () => {
  mockParams = { invite: '1' };
  await renderWithTamagui(<TeamScreen />);
  mockParams = {};
  expect(screen.getByText('Invite to Caretakers')).toBeTruthy();
});

test('a saved invite whose email fails says so', async () => {
  mockAdd.mockResolvedValue(true);
  mockSendAsync.mockRejectedValue(new Error('rate limited'));
  await renderWithTamagui(<TeamScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Invite someone' }));
  await fireEvent.changeText(screen.getByLabelText('Email'), 'sam@example.test');
  await fireEvent.press(screen.getByRole('button', { name: 'Email an invite' }));
  expect(await screen.findByText(/The invite is saved, but the email didn’t send \(rate limited\)/)).toBeTruthy();
});

test('an employee sees the team and cannot manage it', async () => {
  mockRole = 20;
  await renderWithTamagui(<TeamScreen />);
  expect(screen.getByText('Ada (you)')).toBeTruthy();
  expect(screen.getByText('Jo')).toBeTruthy();
  expect(screen.getByText('Only people who can invite and manage staff change roles here.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Manage$/ })).toBeNull();
  expect(screen.queryByLabelText('Search the team')).toBeNull();
  expect(screen.getByText('Team · 2')).toBeTruthy();
  expect(screen.queryByText('Invite someone')).toBeNull();
  expect(screen.queryByText('jo@example.test')).toBeNull();
  expect(screen.queryByText(/Invited as Bartender/)).toBeNull();
});

test('the team is grouped by role, Admin first, or listed A to Z with role tags', async () => {
  mockRole = 20;
  await renderWithTamagui(<TeamScreen />);
  expect(screen.getByRole('radio', { name: 'Role', checked: true })).toBeTruthy();
  const headings = screen.getAllByRole('heading').map((h) => h.props.children);
  expect(headings.indexOf('Admin · 1')).toBeGreaterThan(-1);
  expect(headings.indexOf('Admin · 1')).toBeLessThan(headings.indexOf('Employee · 1'));
  expect(screen.queryByText('Employee')).toBeNull();

  await fireEvent.press(screen.getByRole('radio', { name: 'A to Z' }));
  expect(screen.queryByText('Admin · 1')).toBeNull();
  expect(screen.getByText('Employee')).toBeTruthy();
  expect(screen.getByText('Admin')).toBeTruthy();
});
