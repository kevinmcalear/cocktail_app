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
const flat = { sweet: 0.4, sour: 0.3, bitter: 0.2, strong: 0.7, botanical: 0.1, herbal: 0.1, fruity: 0.2, spiced: 0, spicy: 0, smoky: 0.05, savory: 0, creamy: 0.1 };
const mezcal = { ...flat, bitter: 0.9, smoky: 0.85, sweet: 0.55 };
const colada = { ...flat, sweet: 0.9, fruity: 0.95, creamy: 0.8 };
/** The flower's spoken label: its tastes, strongest first, in words. */
const flower = () => screen.getAllByLabelText(/^Palate:/)[0].props['aria-label'] as string;

beforeEach(() => {
  mockUser = { id: 'me' };
  mockSave.mockReset();
  mockSave.mockImplementation((_answers, opts) => opts?.onSuccess?.());
  mockMe = {
    taste: ranked,
    basis: 'ranked',
    rankedDrinks: 20,
    rankedTaste: ranked,
    answers: { smoky: 0.1 },
    baseline: flat,
    entries: [
      { itemId: 'mn', name: 'Mezcal Negroni', score: 9.4, sentiment: 'loved', createdAt: '2026-08-02T10:00:00Z', profile: mezcal },
      { itemId: 'pc', name: 'Piña Colada', score: 2.1, sentiment: 'disliked', createdAt: '2026-10-02T10:00:00Z', profile: colada },
    ],
  };
});

describe('TasteScreen', () => {
  test('shows where your taste comes from and where your rankings have moved it', async () => {
    await renderWithTamagui(<TasteScreen />);
    expect(screen.getByText(/Your rankings are 80% of it now/)).toBeTruthy();
    expect(screen.getByText('Your rankings lean more smoky than you said.')).toBeTruthy();
    expect(flower()).toMatch(/^Palate: bitter intensely/);
  });

  test('what shaped it: a loved drink pulls, a disliked one pushes; and how it moved month to month', async () => {
    await renderWithTamagui(<TasteScreen />);
    expect(screen.getByRole('link', { name: 'Mezcal Negroni, 9.4. More smoky and bitter' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Piña Colada, 2.1. Less fruity and creamy' })).toBeTruthy();
    expect(screen.getByText('+ smoky')).toBeTruthy();
    expect(screen.getByText('− creamy')).toBeTruthy();
    expect(screen.getByText('Over time')).toBeTruthy();
  });

  test('changing an answer moves the flower, and Save keeps it', async () => {
    await renderWithTamagui(<TasteScreen />);
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    // Open the bitter question; "Not for me" pulls it down from intensely.
    await fireEvent.press(screen.getByRole('button', { name: 'Bitter, like a Negroni? Not answered' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Not for me' }));
    expect(flower()).toMatch(/bitter very/);
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
