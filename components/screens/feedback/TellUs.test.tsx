import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { FeedbackSheet } from './FeedbackSheet';
import { TellUs, TellUsPlace } from './TellUs';

const mockSend = jest.fn();
jest.mock('@/hooks/useFeedback', () => ({ useSendFeedback: () => ({ mutate: mockSend, reset: jest.fn(), isPending: false }) }));
jest.mock('@/lib/toast', () => ({ toastDone: jest.fn() }));
jest.mock('expo-router', () => ({ usePathname: () => '/add-cocktail' }));

beforeEach(() => mockSend.mockReset());

const disabled = (name: string) => {
  const b = screen.getByRole('button', { name });
  return b.props['aria-disabled'] ?? b.props.accessibilityState?.disabled;
};

test('Tell us under a list sends a note that says the step, the drink and the bar', async () => {
  await renderWithTamagui(
    <TellUsPlace value={{ flow: 'Adding a drink', subject: 'Ash Garden', barId: 'bar-1', barName: 'Little Rye' }}>
      <TellUs step="Ice" what="ice" />
    </TellUsPlace>
  );
  await fireEvent.press(screen.getByRole('button', { name: /^Doing something different\? Tell us\. We’ll add your ice/ }));
  expect(screen.getByText('Sent with: Adding a drink › Ice · Ash Garden · Little Rye')).toBeTruthy();
  expect(disabled('Send')).toBe(true);
  await fireEvent.changeText(screen.getByLabelText('What you do'), ' Graduated blocks, stacked ');
  await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
  expect(mockSend.mock.calls[0][0]).toMatchObject({ kind: 'different', screen: 'Adding a drink › Ice', route: '/add-cocktail', subject: 'Ash Garden', bar_id: 'bar-1', body: 'Graduated blocks, stacked' });
});

test('Report a problem needs its kind, not words; the email shows only once sending fails', async () => {
  await renderWithTamagui(<FeedbackSheet visible onClose={jest.fn()} mode="problem" place={{ screen: 'Settings › Report a problem' }} />);
  expect(screen.queryByRole('button', { name: 'Email us instead' })).toBeNull();
  expect(disabled('Send')).toBe(true);
  await fireEvent.press(screen.getByRole('radio', { name: 'It’s slow' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
  expect(mockSend.mock.calls[0][0]).toMatchObject({ kind: 'slow', screen: 'Settings › Report a problem', body: '', bar_id: null });
  // The insert fails: say why, and offer the email.
  const onError = mockSend.mock.calls[0][1].onError as (e: Error) => void;
  await act(() => onError(new Error('It didn’t send. Check your connection and try again, or email us instead.')));
  expect(screen.getByText(/It didn’t send/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Email us instead' })).toBeTruthy();
});
