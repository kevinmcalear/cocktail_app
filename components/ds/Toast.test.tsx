import { act, fireEvent, screen } from '@testing-library/react-native';

import { ToastHost } from '@/components/ds/Toast';
import { renderWithProviders } from '@/jest.setup';
import { useToastStore } from '@/store/useToastStore';

afterEach(() => useToastStore.getState().hide());

test('a toast says what happened, is announced, and its action runs once and closes it', async () => {
  const undo = jest.fn();
  await renderWithProviders(<ToastHost />);
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
  await renderWithProviders(<ToastHost />);
  await act(async () => {
    useToastStore.getState().show({ title: 'First' });
    useToastStore.getState().show({ title: 'Second' });
  });
  expect(screen.queryByText('First')).toBeNull();
  await fireEvent.press(screen.getByRole('status'));
  expect(useToastStore.getState().toast).toBeNull();
});

test('a refused save is announced as an alert and does not wear the success tick', async () => {
  await renderWithProviders(<ToastHost />);
  await act(async () => {
    useToastStore.getState().show({ title: 'Couldn’t save the rota', detail: 'It’s back as it was. Try again.', tone: 'error' });
  });
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(screen.queryByRole('status')).toBeNull();
  await fireEvent.press(screen.getByRole('alert'));
  expect(useToastStore.getState().toast).toBeNull();
});

test('an error toast stays past the five seconds a success toast goes after', async () => {
  jest.useFakeTimers();
  try {
    await renderWithProviders(<ToastHost />);
    await act(async () => void useToastStore.getState().show({ title: 'Saved' }));
    await act(async () => void jest.advanceTimersByTime(6000));
    expect(useToastStore.getState().toast).toBeNull();
    await act(async () => void useToastStore.getState().show({ title: 'Couldn’t save the rota', tone: 'error' }));
    await act(async () => void jest.advanceTimersByTime(60000));
    expect(useToastStore.getState().toast?.title).toBe('Couldn’t save the rota');
  } finally {
    jest.useRealTimers();
  }
});
