import { fireEvent, screen } from '@testing-library/react-native';

import Login from '@/app/auth/login';
import { renderWithProviders } from '@/jest.setup';

const mockPush = jest.fn();
let mockClip: string | null = null;
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  useRouter: () => ({ replace: jest.fn(), push: mockPush, back: jest.fn() }),
}));
jest.mock('@/ctx/AuthContext', () => ({
  useAuth: () => ({ sendCode: jest.fn(), verifyCode: jest.fn() }),
}));
jest.mock('@/lib/clipboardPeek', () => ({ readClipboard: async () => mockClip }));

beforeEach(() => {
  mockPush.mockReset();
  mockClip = null;
});

test('signed out meets Welcome, and Continue with email opens the email step, with Back to Welcome', async () => {
  await renderWithProviders(<Login />);
  expect(screen.getByText('Every drink, and who made it.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
  expect(screen.getByLabelText('Email')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Back'));
  expect(screen.getByText('Every drink, and who made it.')).toBeTruthy();
});

test('I have a link from my bar opens a copied staff link, or says where the link is', async () => {
  await renderWithProviders(<Login />);
  await fireEvent.press(screen.getByRole('button', { name: 'I have a link from my bar' }));
  expect(await screen.findByText(/Open the link your bar sent you/)).toBeTruthy();
  expect(mockPush).not.toHaveBeenCalled();

  mockClip = 'https://babyvom.it/v/caretakers?join=abc123';
  await fireEvent.press(screen.getByRole('button', { name: 'I have a link from my bar' }));
  expect(mockPush).toHaveBeenCalledWith('/v/caretakers?join=abc123');
});
