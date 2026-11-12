import { fireEvent, screen } from '@testing-library/react-native';

import Login from '@/app/auth/login';
import { renderWithProviders } from '@/jest.setup';

import { HERO } from './Welcome';

const mockPush = jest.fn();
const mockBack = jest.fn();
let mockStep: string | undefined;
let mockClip: string | null = null;
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  useRouter: () => ({ replace: jest.fn(), push: mockPush, back: mockBack, canGoBack: () => true }),
  useLocalSearchParams: () => ({ step: mockStep }),
}));
jest.mock('@/ctx/AuthContext', () => ({
  useAuth: () => ({ sendCode: jest.fn(), verifyCode: jest.fn() }),
}));
jest.mock('@/lib/clipboardPeek', () => ({ readClipboard: async () => mockClip }));

beforeEach(() => {
  mockPush.mockReset();
  mockBack.mockReset();
  mockStep = undefined;
  mockClip = null;
});

test('all three hero drinks draw (none dropped by the drawing reader)', () => {
  expect(HERO.map((h) => h.seed)).toEqual(['welcome-negroni', 'welcome-martini', 'welcome-clover']);
});

test('signed out meets Welcome; Continue with email opens the email step, whose Back goes back', async () => {
  await renderWithProviders(<Login />);
  expect(screen.getByText('Every drink, and who made it.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
  expect(mockPush).toHaveBeenCalledWith('/auth/login?step=email');

  mockStep = 'email';
  await renderWithProviders(<Login />);
  expect(screen.getByLabelText('Email')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Back'));
  expect(mockBack).toHaveBeenCalled();
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
