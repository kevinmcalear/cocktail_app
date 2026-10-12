import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { MyInvite } from '@/hooks/useBarInvites';

import { InviteWelcome } from './InviteWelcome';

const mockAccept = jest.fn();
let mockHeld: { held: boolean } | undefined;
jest.mock('@/hooks/useBarInvites', () => ({
  useAcceptInvite: () => ({ mutate: mockAccept, isPending: false, error: null, data: mockHeld }),
  useRemoveInvite: () => ({ mutate: jest.fn(), isPending: false, error: null }),
}));

const invite: MyInvite = {
  id: 'i1',
  bar_id: 'venue',
  bar_name: 'Caretakers',
  bar_slug: 'caretakers',
  bar_logo_url: null,
  bar_color: '#D0643B',
  bar_display_face: null,
  bar_ground_tint: null,
  bar_profile_id: null,
  role_level: 30,
  name: 'Sam Rivera',
  invited_by_name: 'Ada',
};

beforeEach(() => {
  mockAccept.mockReset();
  mockHeld = undefined;
});

test('an invite to a venue still waiting on its claim is held, and setup carries on', async () => {
  const onDeclined = jest.fn();
  await renderWithTamagui(<InviteWelcome invite={{ ...invite, held: true }} onJoined={jest.fn()} onDeclined={onDeclined} />);
  expect(screen.getByText(/You join Caretakers once its claim is approved/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Accept and start' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Carry on' }));
  expect(onDeclined).toHaveBeenCalled();
});

test('accepting while the claim waits does not enter the venue', async () => {
  const onJoined = jest.fn();
  mockAccept.mockImplementation((_v, opts) => opts?.onSuccess?.({ held: true }));
  await renderWithTamagui(<InviteWelcome invite={invite} onJoined={onJoined} onDeclined={jest.fn()} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Accept and start' }));
  expect(onJoined).not.toHaveBeenCalled();
});
