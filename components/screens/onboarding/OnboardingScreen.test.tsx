import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { useSettingsStore } from '@/store/useSettingsStore';

import { OnboardingScreen } from './OnboardingScreen';

const mockReplace = jest.fn();
const mockSaveName = jest.fn();
const mockSaveWork = jest.fn();
const mockCreateBar = jest.fn();
const mockFinish = jest.fn();
const mockClaim = jest.fn();
const mockSaveMenu = jest.fn();
const mockSaveDrink = jest.fn();
let mockMeta: { onboarded?: boolean } = { onboarded: false };
let mockPeople: { id: string; handle: string; display_name: string; city: string | null; is_claimed: boolean }[] = [];
let mockBars: { id: string; display_name: string; locality: string | null; postcode: null; city: string; country_code: string; is_closed?: boolean }[] = [];

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn(), canGoBack: () => false }) }));
jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', user_metadata: mockMeta }, loading: false }) }));
jest.mock('@/hooks/useMyProfile', () => ({ useMyProfile: () => ({ data: null, isPending: false, error: null, refetch: jest.fn() }) }));
jest.mock('@/hooks/useOnboarding', () => ({
  useSaveOnboardingName: () => ({ mutate: mockSaveName, isPending: false, error: null }),
  useSaveWorkplace: () => ({ mutate: mockSaveWork, isPending: false, error: null }),
  useCreateOnboardingBar: () => ({ mutate: mockCreateBar, isPending: false, error: null }),
  useSaveWorkedMenu: () => ({ mutate: mockSaveMenu, isPending: false, error: null }),
  useSaveCareerDrink: () => ({ mutate: mockSaveDrink, isPending: false, error: null }),
  useFinishOnboarding: () => ({ mutate: mockFinish, isPending: false, error: null }),
}));
jest.mock('@/hooks/useProfiles', () => ({
  usePublicPeople: (term: string) => ({ data: term.trim().length >= 2 ? mockPeople : [] }),
  useClaimProfile: () => ({ mutate: mockClaim, isPending: false, error: null }),
}));
jest.mock('@/hooks/useRankings', () => ({
  usePublicBars: (term: string) => ({ data: term.trim().length >= 2 ? mockBars : [] }),
}));

const attaboy = { id: 'b1', display_name: 'Attaboy', locality: 'New York', postcode: null, city: 'New York', country_code: 'US' };

beforeEach(() => {
  mockMeta = { onboarded: false };
  mockPeople = [];
  mockBars = [attaboy];
  mockReplace.mockClear();
  mockSaveName.mockReset();
  mockSaveWork.mockReset();
  mockCreateBar.mockReset();
  mockFinish.mockReset();
  mockClaim.mockReset();
  mockSaveMenu.mockReset();
  mockSaveDrink.mockReset();
  mockSaveName.mockImplementation((_input, opts) => opts?.onSuccess?.('p1'));
  useSettingsStore.setState({ specUnit: 'ml', defaultUnit: 'ml' });
});

async function named() {
  await renderWithTamagui(<OnboardingScreen />);
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Jo Juniper');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
}

async function newCareer() {
  await named();
  await fireEvent.press(screen.getByRole('button', { name: 'Yes, I work in hospitality' }));
  await fireEvent.press(screen.getByRole('button', { name: 'None of these' }));
}

describe('OnboardingScreen', () => {
  test('a name is required, then home bartenders skip the workplace and set a unit', async () => {
    await renderWithTamagui(<OnboardingScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Add the name people will see.')).toBeTruthy();
    expect(mockSaveName).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Name'), 'Jo Juniper');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockSaveName).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'I make drinks at home' }));
    expect(mockSaveName).toHaveBeenCalledWith({ name: 'Jo Juniper', handle: 'jo.juniper', profileId: null }, expect.anything());
    expect(screen.queryByText('Where do you work?')).toBeNull();
    expect(screen.getByText('How do you measure?')).toBeTruthy();

    await fireEvent.press(screen.getByRole('radio', { name: 'oz' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(useSettingsStore.getState().specUnit).toBe('oz');
    expect(useSettingsStore.getState().defaultUnit).toBe('oz');
    expect(mockFinish).toHaveBeenCalled();
  });

  test('hospitality claims an existing profile instead of making one', async () => {
    mockPeople = [{ id: 'existing', handle: 'jo.juniper', display_name: 'Jo Juniper', city: 'London', is_claimed: false }];
    mockClaim.mockImplementation((_input, opts) => opts?.onSuccess?.());
    await named();
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, I work in hospitality' }));
    expect(screen.getByText('Do we already have you?')).toBeTruthy();

    await fireEvent.press(screen.getByRole('radio', { name: 'Jo Juniper, London' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Send claim' }));
    expect(mockClaim).toHaveBeenCalledWith({ profile_id: 'existing', message: '', bar_id: null }, expect.anything());
    expect(mockSaveName).not.toHaveBeenCalled();
    expect(screen.getByText('How do you measure?')).toBeTruthy();
  });

  test('hospitality can pick a bar, including a closed one, or add one', async () => {
    await newCareer();
    expect(screen.getByText('Where do you work?')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Search bars'), 'At');
    await fireEvent.press(screen.getByRole('radio', { name: 'Attaboy, New York' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Add your role, like Bartender.')).toBeTruthy();
    expect(mockSaveWork).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Your role'), 'Bartender');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockSaveWork).toHaveBeenCalledWith({ personId: 'p1', barId: 'b1', title: 'Bartender', isCurrent: true }, expect.anything());
  });

  test('a previous place can be a closed bar, then a menu and a cocktail', async () => {
    mockSaveWork.mockImplementation((_input, opts) => opts?.onSuccess?.());
    mockBars = [{ ...attaboy, display_name: 'Milk & Honey', locality: 'New York', is_closed: true, id: 'closed' }];
    await newCareer();
    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.getByText('Anywhere else you’ve worked?')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Search bars'), 'Mi');
    await fireEvent.press(screen.getByRole('radio', { name: 'Milk & Honey, New York, closed' }));
    await fireEvent.changeText(screen.getByLabelText('Your role'), 'Bartender');
    await fireEvent.press(screen.getByRole('button', { name: 'Add place' }));
    expect(mockSaveWork).toHaveBeenCalledWith({ personId: 'p1', barId: 'closed', title: 'Bartender', isCurrent: false }, expect.anything());

    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Menus you worked on')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Search bars'), 'Mi');
    await fireEvent.press(screen.getByRole('radio', { name: 'Milk & Honey, New York, closed' }));
    await fireEvent.changeText(screen.getByLabelText('Menu name'), 'Opening list');
    await fireEvent.press(screen.getByRole('button', { name: 'Add menu' }));
    expect(mockSaveMenu).toHaveBeenCalledWith({ personId: 'p1', barId: 'closed', name: 'Opening list', year: null }, expect.anything());

    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Cocktails you worked on')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Cocktail'), 'Gold Rush');
    await fireEvent.changeText(screen.getByLabelText('Search bars'), 'Mi');
    await fireEvent.press(screen.getByRole('radio', { name: 'Milk & Honey, New York, closed' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add cocktail' }));
    expect(mockSaveDrink).toHaveBeenCalledWith({ personId: 'p1', barId: 'closed', name: 'Gold Rush' }, expect.anything());
  });

  test('adding a bar creates the venue', async () => {
    mockCreateBar.mockImplementation((_name, opts) => opts?.onSuccess?.());
    await newCareer();
    await fireEvent.press(screen.getByRole('button', { name: 'Add your bar' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add bar' }));
    expect(screen.getByText('Add the bar’s name.')).toBeTruthy();
    expect(mockCreateBar).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Bar name'), 'Little Rye');
    await fireEvent.press(screen.getByRole('button', { name: 'Add bar' }));
    expect(mockCreateBar).toHaveBeenCalledWith('Little Rye', expect.anything());
  });

  test('a finished account leaves setup', async () => {
    mockMeta = { onboarded: true };
    await renderWithTamagui(<OnboardingScreen />);
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });
});
