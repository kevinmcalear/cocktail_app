import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { MyTaste } from '@/hooks/useFlavor';

import { TasteScreen } from './TasteScreen';

const mockSave = jest.fn();
let mockMe: MyTaste | null = null;
let mockUser: { id: string } | null = { id: 'me' };

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }) }));
jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => ({ user: mockUser, loading: false }) }));
jest.mock('@/hooks/useFlavor', () => ({
  useMyTaste: () => ({ data: mockMe, isLoading: false, error: null }),
  useSaveTasteAnswers: () => ({ mutate: mockSave, isPending: false, error: null }),
}));

const ranked = { sweet: 0.5, sour: 0.2, bitter: 0.9, strong: 0.8, botanical: 0.1, herbal: 0.5, fruity: 0, spiced: 0, spicy: 0, smoky: 0.8, savory: 0, creamy: 0 };

beforeEach(() => {
  mockUser = { id: 'me' };
  mockSave.mockReset();
  mockSave.mockImplementation((_answers, opts) => opts?.onSuccess?.());
  mockMe = { taste: ranked, basis: 'ranked', rankedDrinks: 20, rankedTaste: ranked, answers: { smoky: 0.1 } };
});

describe('TasteScreen', () => {
  test('shows where your taste comes from and where your rankings have moved it', async () => {
    await renderWithTamagui(<TasteScreen />);
    expect(screen.getByText(/Your rankings are 80% of it now/)).toBeTruthy();
    expect(screen.getByText('Your rankings lean more smoky than you said.')).toBeTruthy();
    expect(screen.getByLabelText('Bitter: intensely')).toBeTruthy();
  });

  test('changing an answer moves the bars, and Save keeps it', async () => {
    await renderWithTamagui(<TasteScreen />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    // Bitter is the first question: "Not for me" pulls it down from intensely.
    await fireEvent.press(screen.getAllByRole('radio', { name: 'Not for me' })[0]);
    expect(screen.getByLabelText('Bitter: very')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(mockSave).toHaveBeenCalledWith({ smoky: 0.1, bitter: 0.1 }, expect.anything());
    expect(screen.getByText('Saved. For you and match scores use it now.')).toBeTruthy();
  });

  test('signed out', async () => {
    mockMe = null;
    mockUser = null;
    await renderWithTamagui(<TasteScreen />);
    expect(screen.getByText('Sign in to see your taste.')).toBeTruthy();
  });
});
