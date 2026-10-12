import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { TeamStep } from './TeamStep';

const mockAdd = jest.fn();
const mockSend = jest.fn();
jest.mock('@/hooks/useBarDetail', () => ({ useSetMemberRole: () => ({ mutateAsync: mockAdd, isPending: false }) }));
jest.mock('@/hooks/useBarInvites', () => ({ useSendInviteEmail: () => ({ mutateAsync: mockSend, isPending: false }) }));

beforeEach(() => {
  mockAdd.mockReset();
  mockSend.mockReset();
  mockAdd.mockResolvedValue(true);
  mockSend.mockResolvedValue({ sent: true });
});

test('several people are invited at once, each saved and emailed, and held while the claim waits', async () => {
  const onDone = jest.fn();
  await renderWithTamagui(<TeamStep barId="v1" name="Little Rye" pending onDone={onDone} />);
  expect(screen.getByText(/they join Little Rye once your claim is approved/)).toBeTruthy();
  await fireEvent.changeText(screen.getAllByLabelText('Name')[0], 'Sam Okafor');
  await fireEvent.changeText(screen.getAllByLabelText('Email')[0], 'sam@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Add another' }));
  await fireEvent.changeText(screen.getAllByLabelText('Name')[1], 'Mia Chen');
  await fireEvent.changeText(screen.getAllByLabelText('Email')[1], 'mia@example.com');
  await fireEvent.press(screen.getAllByRole('button', { name: /^Role: Bartender/ })[1]);
  await fireEvent.press(screen.getByRole('radio', { name: /^Drink Creator/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Send 2 invites' }));
  expect(mockAdd).toHaveBeenCalledWith({ email: 'sam@example.com', roleLevel: 30, name: 'Sam Okafor' });
  expect(mockAdd).toHaveBeenCalledWith({ email: 'mia@example.com', roleLevel: 35, name: 'Mia Chen' });
  expect(mockSend).toHaveBeenCalledTimes(2);
  expect(onDone).toHaveBeenCalledWith(['Sam', 'Mia']);
});

test('a bad email stops the send and says why', async () => {
  const onDone = jest.fn();
  await renderWithTamagui(<TeamStep barId="v1" name="Little Rye" pending={false} onDone={onDone} />);
  await fireEvent.changeText(screen.getByLabelText('Email'), 'sam@');
  await fireEvent.press(screen.getByRole('button', { name: 'Send the invite' }));
  expect(screen.getByText('That email doesn’t look right.')).toBeTruthy();
  expect(mockAdd).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Skip for now' }));
  expect(onDone).toHaveBeenCalledWith([]);
});
