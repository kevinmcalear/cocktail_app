import { screen } from '@testing-library/react-native';

import { StaffLinkDoor } from '@/components/auth/StaffLinkDoor';
import { renderWithProviders } from '@/jest.setup';

let mockMine: { data: { created_at: string; declined_at: string | null }; isPending: false; isError: false };
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock('@/ctx/AuthContext', () => jest.requireActual('@/jest.authMock').mockAuthContext(() => ({ user: { id: 'me' }, signOut: jest.fn() })));
jest.mock('@/hooks/useJoinRequests', () => ({
  useStaffLinkDoor: () => ({ data: { bar_id: 'bar', link_on: true, approve: true, me: 'Sam Whitlock', admin_name: 'Ana', admin_count: 2, join_role: 30 }, isPending: false, isError: false }),
  useMyJoinRequest: () => mockMine,
  useJoinByStaffLink: () => ({ mutate: jest.fn(), isPending: false, error: null }),
  useTakeBackJoinRequest: () => ({ mutate: jest.fn(), isPending: false, error: null }),
}));

const brand = { name: 'Caretaker’s' } as never;
const door = () => renderWithProviders(<StaffLinkDoor token="secret" barId="bar" brand={brand} onJoined={jest.fn()} fallback={null} />);

describe('StaffLinkDoor, ask to join', () => {
  it('says the team turned them down last time (board Keep-phone join, step 6)', async () => {
    mockMine = { data: { created_at: '2026-11-01T19:00:00Z', declined_at: '2026-11-01T19:30:00Z' }, isPending: false, isError: false };
    await door();
    expect(screen.getByText('The team said no last time.')).toBeTruthy();
    expect(screen.queryByText('Ask to join')).toBeNull();
    expect(screen.getByText('Done')).toBeTruthy();
  });
});
