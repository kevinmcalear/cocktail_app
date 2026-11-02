import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { View } from 'react-native';

import { ToastHost } from '@/components/ds/Toast';
import { renderWithProviders } from '@/jest.setup';
import { useToastStore } from '@/store/useToastStore';

afterEach(() => useToastStore.getState().hide());

test('a toast shown from an open sheet draws once, in the sheet, and at the root after it closes', async () => {
  const App = ({ sheet }: { sheet: boolean }) => (
    <>
      <View testID="root">
        <ToastHost />
      </View>
      {sheet ? (
        <View testID="sheet">
          <ToastHost />
        </View>
      ) : null}
    </>
  );
  const { rerender } = await renderWithProviders(<App sheet />);
  await act(async () => {
    useToastStore.getState().show({ title: 'The photo didn’t upload', tone: 'error' });
  });
  expect(screen.getAllByText('The photo didn’t upload')).toHaveLength(1);
  expect(within(screen.getByTestId('sheet')).getByText('The photo didn’t upload')).toBeTruthy();
  await act(async () => rerender(<App sheet={false} />));
  expect(within(screen.getByTestId('root')).getByText('The photo didn’t upload')).toBeTruthy();
});

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
