import { fireEvent, screen, within } from '@testing-library/react-native';

import { MemberPage } from '@/components/screens/team/MemberPage';
import { TeamScreen } from '@/components/screens/team/TeamScreen';
import { renderWithProviders } from '@/jest.setup';

const mockMutate = jest.fn();
const mockRemove = jest.fn(() => Promise.resolve());
const mockShown = jest.fn();
const mockSaveLink = jest.fn();
const mockNewLink = jest.fn();
let mockLink: { slug: string; token: string | null; on: boolean; role: number; approve: boolean } = { slug: 'caretakers', token: 'secret', on: true, role: 30, approve: true };
const mockAdd = jest.fn();
const mockInviteRole = jest.fn();
const mockSend = jest.fn();
const mockSendAsync = jest.fn();
let mockRole = 40;
let mockCustomInvite = false;

jest.mock('@/components/screens/profile/JobRequests', () => ({ JobRequests: () => null, MyJobRequests: () => null }));
jest.mock('./JoinRequests', () => ({ JoinRequests: () => null, ClaimsToConfirm: () => null }));
jest.mock('@/components/screens/venue/DeleteVenue', () => ({ VenueDeleteBanner: () => null }));
jest.mock('@/components/maker/MakerCreditRequests', () => ({ MakerCreditRequests: () => null }));
let mockParams: { invite?: string } = {};
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: jest.fn(), push: mockPush, back: jest.fn(), canGoBack: () => false }), useLocalSearchParams: () => mockParams }));
// A logo set: the look is done, so Invite isn't held back.
let mockBrand: { logo_url: string | null; primary_color: string | null; display_face: string } = { logo_url: 'https://example.test/logo.png', primary_color: null, display_face: 'instrument' };
jest.mock('@/hooks/useVenueBrand', () => ({ useVenueBrand: () => ({ data: mockBrand }) }));
const mockSaveWelcome = jest.fn();
let mockWelcome: string | null = null;
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
jest.mock('burnt', () => ({ toast: jest.fn() }));
jest.mock('@/hooks/useStaffLink', () => ({
  useStaffLink: () => ({ data: mockLink, isLoading: false, error: null }),
  useSaveStaffLink: () => ({ mutate: mockSaveLink, error: null }),
  useNewStaffLink: () => ({ mutate: mockNewLink, isPending: false, error: null }),
}));
jest.mock('@/hooks/useTeam', () => ({
  ...jest.requireActual('@/hooks/useTeam'),
  useOnShiftTonight: () => new Set(['jo']),
  useBarOwner: () => ({ data: null }),
  useMemberStats: () => ({ credited: 4, onList: { name: 'Autumn', count: 2 }, nextShift: null, loading: false, failed: false }),
  useMemberPosition: () => ({ data: { id: 'pos', is_hidden: false } }),
  useSetPositionShown: () => ({ mutate: mockShown, isPending: false, error: null }),
}));
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
  useRemoveMember: () => ({ mutateAsync: mockRemove, isPending: false, error: null }),
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
jest.mock('@/hooks/useTakeover', () => ({ useInviteToRole: () => ({ mutateAsync: mockInviteRole, isPending: false, error: null }) }));
jest.mock('@/hooks/useProfiles', () => ({ ...jest.requireActual('@/hooks/useProfiles'), usePublicPeople: () => ({ data: [], isFetching: false }) }));
jest.mock('@/hooks/useBarInvites', () => ({
  useInviteProfile: () => ({ mutateAsync: jest.fn(), isPending: false, error: null }),
  useBarInvites: (_barId: string, enabled: boolean) => ({
    data: enabled ? [{ id: 'i1', email: 'new@example.test', role_level: 30, venue_role_id: null, name: 'Nia', created_at: '2026-01-01T00:00:00Z' }, ...(mockCustomInvite ? [{ id: 'i2', email: 'bb@example.test', role_level: 20, venue_role_id: 'bb', name: 'Bo', created_at: '2026-01-01T00:00:00Z' }] : [])] : [],
  }),
  useRemoveInvite: () => ({ mutate: mockMutate, isPending: false, error: null }),
  useSendInviteEmail: () => ({ mutate: mockSend, mutateAsync: mockSendAsync, isPending: false, error: null }),
  useWelcomeMessage: () => ({ data: mockWelcome, isLoading: false, isSuccess: true, error: null }),
  useSenderName: () => 'Ada Lovelace',
  useSaveWelcomeMessage: () => ({ mutate: mockSaveWelcome, mutateAsync: mockSaveWelcome, isPending: false, error: null }),
}));

beforeEach(() => {
  mockRole = 40;
  mockCustomInvite = false;
  mockMutate.mockClear();
  mockChoose.mockClear();
  mockRemove.mockClear();
  mockLink = { slug: 'caretakers', token: 'secret', on: true, role: 30, approve: true };
  mockAdd.mockReset();
  mockInviteRole.mockReset();
  mockSend.mockReset();
  mockSendAsync.mockReset();
  mockSaveWelcome.mockReset();
  mockPush.mockReset();
  mockWelcome = null;
  mockBrand = { logo_url: 'https://example.test/logo.png', primary_color: null, display_face: 'instrument' };
});

test('an admin invites by email and role from the sheet, and the invite is emailed', async () => {
  mockAdd.mockResolvedValue(true);
  mockSendAsync.mockResolvedValue({ sent: true });
  await renderWithProviders(<TeamScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Invite someone' }));
  expect(screen.getByText('Invite to Caretakers')).toBeTruthy();
  await fireEvent.press(screen.getByText('By email'));
  expect(screen.getByRole('radio', { name: 'Bartender. Menu, specs, house-made, prep', checked: true })).toBeTruthy();
  expect(within(screen.getByLabelText('As')).queryByRole('radio', { name: /^Guest/ })).toBeNull();
  // The old form's note and preview are gone.
  expect(screen.queryByRole('button', { name: 'Preview the email' })).toBeNull();

  // An email stands alone: no second field.
  await fireEvent.changeText(screen.getByLabelText('Name or email'), ' Sam@Example.test ');
  expect(screen.queryByLabelText(/’s email$/)).toBeNull();
  await fireEvent.press(screen.getByRole('radio', { name: 'Drink Creator. Adds and edits drinks and menus' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Send invite' }));
  // The first invite keeps the suggested welcome on the venue, as Your team would.
  expect(mockSaveWelcome).toHaveBeenCalledWith(expect.stringMatching(/^Welcome to Caretakers\. /));
  expect(mockAdd).toHaveBeenCalledWith({ email: 'sam@example.test', roleLevel: 35, name: '' });
  expect(mockSendAsync).toHaveBeenCalledWith('sam@example.test');
  expect(await screen.findByText('Invite emailed to sam@example.test.')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Resend' }));
  expect(mockSend).toHaveBeenLastCalledWith('new@example.test', expect.anything());
});

test('a name asks for an email, and a custom role is invited by its id', async () => {
  mockInviteRole.mockResolvedValue(undefined);
  mockSendAsync.mockResolvedValue({ sent: true });
  await renderWithProviders(<TeamScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Invite someone' }));
  await fireEvent.press(screen.getByText('By email'));
  await fireEvent.changeText(screen.getByLabelText('Name or email'), 'Sam Okafor');
  // Without an email, Send says what's missing and sends nothing.
  await fireEvent.press(screen.getByRole('button', { name: 'Send invite' }));
  expect(await screen.findByText('Add Sam’s email.')).toBeTruthy();
  expect(mockInviteRole).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('Sam’s email'), 'sam@example.test');
  await fireEvent.press(screen.getByRole('radio', { name: 'Barback. Sees menus, talking points and where things live' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Send invite' }));
  expect(mockInviteRole).toHaveBeenCalledWith({ email: 'sam@example.test', roleId: 'bb', name: 'Sam Okafor' });
  expect(mockAdd).not.toHaveBeenCalled();
  expect(mockSendAsync).toHaveBeenCalledWith('sam@example.test');
  expect(await screen.findByText('Invite emailed to Sam Okafor.')).toBeTruthy();
});

test('a refused invite shows the database’s words and keeps the sheet open', async () => {
  mockInviteRole.mockRejectedValue({ message: 'They’re already on your team.' });
  await renderWithProviders(<TeamScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Invite someone' }));
  await fireEvent.press(screen.getByText('By email'));
  await fireEvent.changeText(screen.getByLabelText('Name or email'), 'jo@example.test');
  await fireEvent.press(screen.getByRole('radio', { name: 'Barback. Sees menus, talking points and where things live' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Send invite' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(mockSendAsync).not.toHaveBeenCalled();
  expect(screen.getByText('Invite to Caretakers')).toBeTruthy();
});

test('the staff link tab: the code, the join role and approval, and the link off', async () => {
  await renderWithProviders(<TeamScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Invite someone' }));
  expect(screen.getByLabelText('QR code for Caretakers’s staff link')).toBeTruthy();
  await fireEvent.press(screen.getByRole('link', { name: 'New people join as, Bartender' }));
  expect(within(screen.getByLabelText('New people join as')).queryByRole('radio', { name: /^Admin/ })).toBeNull();
  await fireEvent.press(screen.getByRole('radio', { name: /^Employee/ }));
  expect(mockSaveLink).toHaveBeenCalledWith({ role: 20 });
  await fireEvent(screen.getByRole('switch', { name: 'You approve each one' }), 'valueChange', false);
  expect(mockSaveLink).toHaveBeenCalledWith({ approve: false });
});

test('the staff link carries its secret, and New link replaces it', async () => {
  await renderWithProviders(<TeamScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Invite someone' }));
  expect(screen.getByText(/\/v\/caretakers\?join=secret$/)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('New link'));
  expect(mockNewLink).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Make a new link' }));
  expect(mockNewLink).toHaveBeenCalled();
});

test('without the secret (RLS shows it to Admins only), no code and no link', async () => {
  mockLink = { ...mockLink, token: null };
  await renderWithProviders(<TeamScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Invite someone' }));
  expect(screen.queryByLabelText('QR code for Caretakers’s staff link')).toBeNull();
  expect(screen.getByText('An Admin shares Caretakers’s staff link.')).toBeTruthy();
  expect(screen.queryByLabelText('New link')).toBeNull();
});

test('with the link off, the tab says so and offers it back', async () => {
  mockLink = { ...mockLink, on: false };
  await renderWithProviders(<TeamScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Invite someone' }));
  expect(screen.getByText(/The staff link is off/)).toBeTruthy();
  expect(screen.queryByLabelText('QR code for Caretakers’s staff link')).toBeNull();
});

test('an admin changes the welcome message once, from its row', async () => {
  mockWelcome = 'Welcome in.';
  await renderWithProviders(<TeamScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Welcome message. Change' }));
  await fireEvent.changeText(screen.getByLabelText('The message'), 'Welcome to the team.');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(mockSaveWelcome).toHaveBeenCalledWith('Welcome to the team.', expect.anything());
});

test('Invite waits for how the venue looks: until then it opens Theme', async () => {
  mockBrand = { logo_url: null, primary_color: null, display_face: 'instrument' };
  await renderWithProviders(<TeamScreen />);
  expect(screen.getByText('Set how Caretakers looks first: the invite wears its logo, colour and font.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Invite someone' }));
  expect(mockPush).toHaveBeenCalledWith('/settings/bar/bar/theme');
  expect(screen.queryByText('Invite to Caretakers')).toBeNull();
});

test('/team?invite=1 opens on the invite sheet (Invite your team, from the venue sheet or an empty Library)', async () => {
  mockParams = { invite: '1' };
  await renderWithProviders(<TeamScreen />);
  mockParams = {};
  expect(screen.getByText('Invite to Caretakers')).toBeTruthy();
});

test('a saved invite whose email fails says so', async () => {
  mockAdd.mockResolvedValue(true);
  mockSendAsync.mockRejectedValue(new Error('rate limited'));
  await renderWithProviders(<TeamScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Invite someone' }));
  await fireEvent.press(screen.getByText('By email'));
  await fireEvent.changeText(screen.getByLabelText('Name or email'), 'sam@example.test');
  await fireEvent.press(screen.getByRole('button', { name: 'Send invite' }));
  expect(await screen.findByText(/The invite is saved, but the email didn’t send \(rate limited\)/)).toBeTruthy();
});

test('an admin sees the team in the board’s groups, who is on tonight, and the invited, and opens a person', async () => {
  await renderWithProviders(<TeamScreen />);
  expect(screen.getByText('Caretakers · 2 people')).toBeTruthy();
  const headings = screen.getAllByRole('heading').map((h) => h.props.children);
  expect(headings).toEqual(expect.arrayContaining(['Admins', 'Floor', 'Invited']));
  expect(headings.indexOf('Admins')).toBeLessThan(headings.indexOf('Floor'));
  expect(screen.getByText('Employee · on shift tonight')).toBeTruthy();
  expect(screen.getByText(/^Invited as Bartender · \d+ \w+$/)).toBeTruthy();
  // Your own row doesn't open: nobody demotes or removes themselves here.
  expect(screen.queryByRole('button', { name: /^Ada,/ })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Jo, Employee · on shift tonight' }));
  expect(mockPush).toHaveBeenCalledWith('/team/jo');
});

test('an employee sees the team and cannot open anyone or see invites', async () => {
  mockRole = 20;
  await renderWithProviders(<TeamScreen />);
  expect(screen.getByText('Ada (you)')).toBeTruthy();
  expect(screen.getByText('Jo')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^Jo,/ })).toBeNull();
  expect(screen.queryByText('Invite someone')).toBeNull();
  expect(screen.queryByText(/Invited as Bartender/)).toBeNull();
});

test('a person’s page: their numbers, a new role, and Remove', async () => {
  const onRemoved = jest.fn();
  await renderWithProviders(
    <MemberPage barId="bar" barName="Caretakers" role={40} onRemoved={onRemoved} member={{ user_id: 'jo', email: 'jo@example.test', role_level: 20, display_name: 'Jo Park', joined_at: '2026-03-04T00:00:00Z' }} />
  );
  expect(screen.getByText('Employee · since March 2026')).toBeTruthy();
  expect(screen.getByText('drinks credited')).toBeTruthy();
  expect(screen.getByText('on Autumn')).toBeTruthy();
  await fireEvent(screen.getByRole('switch', { name: 'Shows on Caretakers’s page' }), 'valueChange', false);
  expect(mockShown).toHaveBeenCalledWith({ id: 'pos', shown: false });
  await fireEvent.press(screen.getByRole('link', { name: 'Role, Employee' }));
  expect(within(screen.getByLabelText('Role for Jo Park')).getByRole('radio', { name: 'Guest. Sees the menu only' })).toBeTruthy();
  await fireEvent.press(within(screen.getByLabelText('Role for Jo Park')).getByRole('radio', { name: 'Bartender. Menu, specs, house-made, prep' }));
  expect(mockChoose).toHaveBeenCalledWith({ userId: 'jo', choice: { level: 30 } }, expect.anything());
  await fireEvent.press(within(screen.getByLabelText('Role for Jo Park')).getByRole('radio', { name: 'Barback. From Employee, plus prep' }));
  expect(mockChoose).toHaveBeenLastCalledWith({ userId: 'jo', choice: { venueRoleId: 'bb' } }, expect.anything());
  await fireEvent.press(screen.getByRole('button', { name: 'Remove Jo from Caretakers' }));
  expect(mockRemove).toHaveBeenCalledWith('jo');
  await new Promise(process.nextTick);
  expect(onRemoved).toHaveBeenCalled();
  expect(screen.getByText('Jo’s name stays on the drinks they made.')).toBeTruthy();
});

test('an invite to one of the bar’s own roles says that role, not its base level', async () => {
  mockCustomInvite = true;
  await renderWithProviders(<TeamScreen />);
  expect(screen.getByText(/^Invited as Barback · /)).toBeTruthy();
});
