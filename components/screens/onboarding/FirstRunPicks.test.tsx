import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';
import { LABEL, type Dimension, type Profile } from '@/lib/flavor';
import { useSettingsStore } from '@/store/useSettingsStore';

import { FirstRunTaste } from './FirstRunPicks';

const mockSaveTaste = jest.fn();
const profile = (some: Partial<Profile>) => Object.fromEntries((Object.keys(LABEL) as Dimension[]).map((d) => [d, some[d] ?? 0])) as Profile;
const names = ['Negroni', 'House Martini', 'Old Fashioned', 'Daiquiri', 'Penicillin', 'Aperol Spritz', 'Clover Club', 'Last Word', 'Bee’s Knees'];
const stirred = new Set(['Negroni', 'House Martini', 'Old Fashioned']);
const mockDrinks = names.map((name, i) => ({
  id: `d${i}`,
  name: name === 'House Martini' ? 'Martini' : name,
  label: name,
  tint: null,
  method: stirred.has(name) ? 'stir' : 'shake',
  profile: profile(name === 'Negroni' ? { bitter: 0.9, sweet: 0.4 } : name === 'Daiquiri' ? { sour: 0.8, sweet: 0.4 } : { sweet: 0.3 }),
}));

let mockOffered = mockDrinks;
jest.mock('@/hooks/useFirstRunDrinks', () => ({ useFirstRunDrinks: () => ({ drinks: mockOffered, ready: true, isLoading: false, error: null, refetch: jest.fn() }) }));
jest.mock('@/hooks/useFlavor', () => ({ useSaveTasteAnswers: () => ({ mutate: mockSaveTaste, isPending: false }) }));
jest.mock('@/hooks/useDiscoverHome', () => ({
  useBestNear: () => ({ rows: [{ barId: 'b1', barHandle: 'attaboy', barName: 'Attaboy', name: 'Negroni', distanceKm: 1.2 }], onMenus: [] }),
}));
jest.mock('@/components/screens/tonight/TonightParts', () => ({ TonightSky: () => null }));
jest.mock('@/components/screens/home/BarMark', () => ({ BarMark: () => null }));
jest.mock('@/components/ds', () => ({ ...jest.requireActual('@/components/ds'), DrinkDrawingFor: () => null }));

beforeEach(() => {
  mockSaveTaste.mockReset();
  mockSaveTaste.mockImplementation((_answers, opts) => opts?.onSettled?.());
  useSettingsStore.setState({ units: null });
  mockOffered = mockDrinks;
});

async function pickFive() {
  for (const name of ['Negroni', 'House Martini', 'Old Fashioned', 'Daiquiri', 'Penicillin']) await fireEvent.press(screen.getByRole('checkbox', { name }));
}

test('five picks, three pairs, then the taste they make, saved on Start', async () => {
  const onDone = jest.fn();
  await renderWithProviders(<FirstRunTaste home pending={false} onDone={onDone} />);
  expect(screen.getByText('Which have you had?')).toBeTruthy();
  expect(screen.getByRole('button', { name: '0 of 5' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('Which have you had?')).toBeTruthy();

  // A sixth pick waits for one to be let go.
  await pickFive();
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Last Word' }));
  expect(screen.getByRole('checkbox', { name: 'Last Word', checked: false })).toBeTruthy();
  await fireEvent.press(screen.getAllByRole('button', { name: 'Next' })[0]);

  // Three pairs, always from the five; the Negroni wins where it's offered, else the first card.
  for (let i = 0; i < 3; i++) {
    expect(screen.getByText('Which do you like more?')).toBeTruthy();
    const cards = screen.getAllByRole('button').filter((b) => names.some((n) => b.props.accessibilityLabel?.startsWith(n)));
    expect(cards).toHaveLength(2);
    for (const c of cards) expect(['Negroni', 'House Martini', 'Old Fashioned', 'Daiquiri', 'Penicillin'].some((n) => c.props.accessibilityLabel.startsWith(n))).toBe(true);
    await fireEvent.press(cards.find((c) => c.props.accessibilityLabel.startsWith('Negroni')) ?? cards[0]);
  }

  expect(screen.getByText(/^You like it .+\.$/)).toBeTruthy();
  expect(screen.getByText('Attaboy')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Start' }));
  expect(mockSaveTaste).toHaveBeenCalledWith(expect.objectContaining({ bitter: expect.any(Number) }), expect.anything());
  expect(onDone).toHaveBeenCalledWith(undefined);
  expect(useSettingsStore.getState().units).not.toBeNull();
});

test('Back walks the pairs back to the picks, and from the picks leaves', async () => {
  const onBack = jest.fn();
  await renderWithProviders(<FirstRunTaste home pending={false} onBack={onBack} onDone={jest.fn()} />);
  await pickFive();
  await fireEvent.press(screen.getAllByRole('button', { name: 'Next' })[0]);
  expect(screen.getByText('Which do you like more?')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByText('Which have you had?')).toBeTruthy();
  expect(screen.getByRole('checkbox', { name: 'Negroni', checked: true })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(onBack).toHaveBeenCalled();
});

test('a bar under the taste ends setup on its page', async () => {
  const onDone = jest.fn();
  await renderWithProviders(<FirstRunTaste home pending={false} onDone={onDone} />);
  await pickFive();
  await fireEvent.press(screen.getAllByRole('button', { name: 'Next' })[0]);
  for (let i = 0; i < 3; i++) {
    const cards = screen.getAllByRole('button').filter((b) => names.some((n) => b.props.accessibilityLabel?.startsWith(n)));
    await fireEvent.press(cards[0]);
  }
  await fireEvent.press(screen.getByRole('link', { name: /^Attaboy\./ }));
  expect(onDone).toHaveBeenCalledWith('/p/attaboy');
});

test('Your taste has no Back (the board draws none); a bartender gets no unit guessed; fewer than five still lets setup end', async () => {
  const onDone = jest.fn();
  await renderWithProviders(<FirstRunTaste home={false} pending={false} onDone={onDone} />);
  await pickFive();
  await fireEvent.press(screen.getAllByRole('button', { name: 'Next' })[0]);
  for (let i = 0; i < 3; i++) {
    const cards = screen.getAllByRole('button').filter((b) => names.some((n) => b.props.accessibilityLabel?.startsWith(n)));
    await fireEvent.press(cards[0]);
  }
  expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Start' }));
  await fireEvent.press(screen.getByRole('button', { name: /Start|Saving/ }));
  expect(onDone).toHaveBeenCalledTimes(1);
  expect(useSettingsStore.getState().units).toBeNull();

  mockOffered = mockDrinks.slice(0, 3);
  const skip = jest.fn();
  await renderWithProviders(<FirstRunTaste home pending={false} onDone={skip} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
  expect(skip).toHaveBeenCalledWith();
});
