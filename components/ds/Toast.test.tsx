import { act, fireEvent, screen } from '@testing-library/react-native';

import { ToastHost } from '@/components/ds/Toast';
import { renderWithTamagui } from '@/jest.setup';
import { useToastStore } from '@/store/useToastStore';

afterEach(() => useToastStore.getState().hide());

test('a toast says what happened, is announced, and its action runs once and closes it', async () => {
  const undo = jest.fn();
  await renderWithTamagui(<ToastHost />);
  await act(async () => {
    useToastStore.getState().show({ title: 'Penicillin now uses Fernhill', detail: 'The old spec is in its history.', action: { label: 'Undo', onPress: undo } });
  });
  expect(screen.getByText('Penicillin now uses Fernhill')).toBeTruthy();
  expect(screen.getByRole('status')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Undo: Penicillin now uses Fernhill' }));
  expect(undo).toHaveBeenCalledTimes(1);
  expect(useToastStore.getState().toast).toBeNull();
});

test('a new toast replaces the one showing, and tapping it closes it', async () => {
  await renderWithTamagui(<ToastHost />);
  await act(async () => {
    useToastStore.getState().show({ title: 'First' });
    useToastStore.getState().show({ title: 'Second' });
  });
  expect(screen.queryByText('First')).toBeNull();
  await fireEvent.press(screen.getByRole('status'));
  expect(useToastStore.getState().toast).toBeNull();
});
