import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { SignInScreen } from './SignInScreen';

const mockSendCode = jest.fn();
const mockVerifyCode = jest.fn();
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
}));
jest.mock('@/ctx/AuthContext', () => ({
  useAuth: () => ({ sendCode: mockSendCode, verifyCode: mockVerifyCode }),
}));

beforeEach(() => {
  mockSendCode.mockReset().mockResolvedValue({ error: null });
  mockVerifyCode.mockReset().mockResolvedValue({ error: null });
});

test('an email, then the code from it: no password anywhere', async () => {
  await renderWithTamagui(<SignInScreen />);
  expect(screen.queryByLabelText(/password/i)).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'Email me a code' }));
  expect(screen.getByText('Enter the email you want to sign in with.')).toBeTruthy();
  expect(mockSendCode).not.toHaveBeenCalled();

  await fireEvent.changeText(screen.getByLabelText('Email'), ' jo@example.com ');
  await fireEvent.press(screen.getByRole('button', { name: 'Email me a code' }));
  expect(mockSendCode).toHaveBeenCalledWith('jo@example.com');
  expect(await screen.findByText('Check your email')).toBeTruthy();

  // A pasted code with a space fills every box and signs in.
  await fireEvent.changeText(screen.getByLabelText('6-digit code from the email'), '482 913');
  expect(mockVerifyCode).toHaveBeenCalledWith('jo@example.com', '482913');
});

test('a wrong code says so and how to fix it', async () => {
  mockVerifyCode.mockResolvedValue({ error: { message: 'Token has expired or is invalid', code: 'otp_expired' } });
  await renderWithTamagui(<SignInScreen />);
  await fireEvent.changeText(screen.getByLabelText('Email'), 'jo@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Email me a code' }));
  await fireEvent.changeText(await screen.findByLabelText('6-digit code from the email'), '000000');
  expect(await screen.findByText(/That code doesn’t match/)).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Use a different email' }));
  expect(screen.getByLabelText('Email').props.value).toBe('jo@example.com');
});

test('the code step signs in on its own: Back, a countdown, no Sign in button or footer', async () => {
  await renderWithTamagui(<SignInScreen />);
  await fireEvent.changeText(screen.getByLabelText('Email'), 'jo@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Email me a code' }));
  await screen.findByText('Check your email');

  expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
  expect(screen.queryByText('Help and support')).toBeNull();
  expect(screen.getByText('Nothing yet? Check spam, or send a new code in 1:00.')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('Back'));
  expect(screen.getByLabelText('Email').props.value).toBe('jo@example.com');
});

test('a venue staff link without a logo wears its initials', async () => {
  await renderWithTamagui(<SignInScreen brand={{ name: 'Little Rye', logoUrl: null }} />);
  expect(screen.getByLabelText('Little Rye logo')).toBeTruthy();
  expect(screen.getByText('LR')).toBeTruthy();
});
