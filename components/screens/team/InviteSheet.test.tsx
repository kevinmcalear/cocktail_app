import { fireEvent, screen } from '@testing-library/react-native';

import { InviteSheet } from '@/components/screens/team/InviteSheet';
import { renderWithProviders } from '@/jest.setup';

// Finding people by name in Invite > By email (the sheet's other paths are in TeamScreen.test.tsx).
const mockInviteProfile = jest.fn();
const mockSendAsync = jest.fn();
const mockDone = jest.fn();
let mockPeople: { id: string; display_name: string; city: string | null; is_claimed: boolean; current_bar: string | null }[] = [];

jest.mock('./StaffLinkTab', () => ({ StaffLinkTab: () => null }));
jest.mock('@/lib/dialogs', () => ({ confirmAsync: jest.fn(async () => true) }));
jest.mock('@/hooks/useBarDetail', () => ({ useSetMemberRole: () => ({ mutateAsync: jest.fn(), isPending: false }) }));
jest.mock('@/hooks/useTakeover', () => ({ useInviteToRole: () => ({ mutateAsync: jest.fn(), isPending: false }) }));
jest.mock('@/hooks/useProfiles', () => ({
  usePublicPeople: (q: string) => ({ data: q.length >= 2 ? mockPeople : [], isFetching: false }),
}));
jest.mock('@/hooks/useVenueRoles', () => ({
  useRoleMatrix: () => ({
    data: [{ role_id: 'tk', name: 'Takeover bartender', base_level: 30, ends_at: null, granted: [], revoked: [], capabilities: [] }],
  }),
}));
jest.mock('@/hooks/useBarInvites', () => ({
  useInviteProfile: () => ({ mutateAsync: mockInviteProfile, isPending: false }),
  useSendInviteEmail: () => ({ mutateAsync: mockSendAsync, isPending: false }),
  useWelcomeMessage: () => ({ data: 'Welcome.', isSuccess: true }),
  useSaveWelcomeMessage: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

const open = async () => {
  await renderWithProviders(<InviteSheet visible onClose={jest.fn()} barId="bar" barName="Caretakers" ceiling={40} admin onDone={mockDone} />);
  await fireEvent.press(screen.getByText('By email'));
};

beforeEach(() => {
  mockInviteProfile.mockReset();
  mockSendAsync.mockReset();
  mockDone.mockReset();
  mockPeople = [
    { id: 'p-sam', display_name: 'Sam Okafor', city: null, is_claimed: true, current_bar: 'Bar Bianca' },
    { id: 'p-ghost', display_name: 'Sam Okonkwo', city: 'Leeds', is_claimed: false, current_bar: null },
  ];
});

test('a name finds people already on the app; picking one invites their page, at a custom role, with no email typed', async () => {
  mockInviteProfile.mockResolvedValue(true);
  mockSendAsync.mockResolvedValue({ sent: true });
  await open();
  await fireEvent.changeText(screen.getByLabelText('Name or email'), 'Sam');
  // Only pages with an account are offered, and no email field while there are people to pick.
  expect(screen.getByText('Sam Okafor, Bar Bianca')).toBeTruthy();
  expect(screen.queryByText(/Okonkwo/)).toBeNull();
  expect(screen.queryByLabelText('Sam’s email')).toBeNull();
  await fireEvent.press(screen.getByText('Sam Okafor, Bar Bianca'));
  await fireEvent.press(screen.getByRole('radio', { name: 'Takeover bartender. Plus prep notes and the staff list' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Send invite' }));
  expect(mockInviteProfile).toHaveBeenCalledWith({ profileId: 'p-sam', roleLevel: 30, roleId: 'tk' });
  expect(mockSendAsync).toHaveBeenCalledWith({ profileId: 'p-sam' });
  expect(mockDone).toHaveBeenCalledWith({ text: 'Invite emailed to Sam Okafor.' });
});

test('someone already on the team just gets the new role', async () => {
  mockInviteProfile.mockResolvedValue(false);
  await open();
  await fireEvent.changeText(screen.getByLabelText('Name or email'), 'Sam');
  await fireEvent.press(screen.getByText('Sam Okafor, Bar Bianca'));
  await fireEvent.press(screen.getByRole('button', { name: 'Send invite' }));
  expect(mockSendAsync).not.toHaveBeenCalled();
  expect(mockDone).toHaveBeenCalledWith({ text: 'Sam Okafor is already on the team. They’re Bartender now.' });
});

test('"None of these" falls back to an email for the typed name', async () => {
  await open();
  await fireEvent.changeText(screen.getByLabelText('Name or email'), 'Sam');
  await fireEvent.press(screen.getByRole('button', { name: 'None of these' }));
  expect(screen.getByLabelText('Sam’s email')).toBeTruthy();
});

test('a name nobody on the app has asks for an email', async () => {
  mockPeople = [];
  await open();
  await fireEvent.changeText(screen.getByLabelText('Name or email'), 'Sam');
  expect(screen.getByLabelText('Sam’s email')).toBeTruthy();
});
