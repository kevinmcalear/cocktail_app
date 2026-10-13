import { fireEvent, screen } from '@testing-library/react-native';
import 'react-native-gesture-handler/jestSetup';

import { renderWithTamagui } from '@/jest.setup';
import { specLines } from '@/lib/spec';
import { useSettingsStore } from '@/store/useSettingsStore';

import { BatchSheet } from './BatchSheet';

jest.mock('@/components/tools/ToolsSheet', () => ({ ToolsSheet: () => null }));
jest.mock('@/lib/shareLink', () => ({ shareText: jest.fn() }));
jest.mock('@/hooks/useBatchPrep', () => ({ useShelfLives: () => ({ data: {} }), useSaveBatchAsPrep: () => ({ mutateAsync: jest.fn(), isPending: false, error: null }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

const line = (id: string, name: string, amount: number, unit: string, abv: number | null = null, atService?: boolean) => ({
  id,
  amount,
  unit,
  at_service: atService,
  display_ingredient_id: id,
  display_ingredient: { id, name, abv },
});

const penicillin = specLines([
  line('scotch', 'Blended Scotch', 60, 'ml', 40),
  line('lemon', 'Lemon juice', 22.5, 'ml'),
  line('hg', 'Honey-ginger syrup', 22.5, 'ml'),
  line('islay', 'Islay Scotch', 7.5, 'ml', 43, true),
]);
const martini = specLines([line('gin', 'London Dry Gin', 75, 'ml', 40), line('dry', 'Dry vermouth', 15, 'ml', 18)]);

const open = (lines = penicillin, methodNames = ['Shake']) =>
  renderWithTamagui(<BatchSheet visible onClose={jest.fn()} name="Penicillin" lines={lines} methodNames={methodNames} lockedUntil={null} initialServes={12} />);

beforeEach(() => useSettingsStore.setState({ freezerC: -18 }));

test('splits the bottle from what each serve adds at the station', async () => {
  await open();
  expect(screen.getByLabelText('720 ml, Blended Scotch')).toBeTruthy();
  expect(screen.getByLabelText('82.5 ml, Penicillin, from the bottle')).toBeTruthy();
  expect(screen.getByLabelText('22.5 ml, Lemon juice, 270 ml for 12, Fresh daily, not in the bottle')).toBeTruthy();
  expect(screen.getByLabelText('In the bottle: 990 ml, 2 × 750 ml bottles, 29% ABV')).toBeTruthy();
  expect(screen.getByText('bottle 29% ABV')).toBeTruthy();
  // The count says what it fills, beside it (board drink-sheet-batch-venue).
  expect(screen.getByText('serves · fills 2 × 750 ml')).toBeTruthy();
  // Shaken to order: the bottle holds no water, and says so (board drink-sheet-batch-venue).
  expect(screen.getByLabelText('0 ml, Water, the shake dilutes it')).toBeTruthy();
  expect(screen.queryByText(/Will slush/)).toBeNull();
});

test('fills a bottle: 12 Penicillins to a litre', async () => {
  await open();
  await fireEvent.press(screen.getByRole('tab', { name: 'Fill a bottle' }));
  await fireEvent.press(screen.getByRole('radio', { name: '1 L' }));
  expect(screen.getByLabelText('In the bottle: 990 ml, 1 × 1 L bottle, 29% ABV')).toBeTruthy();
});

test('starts from what is on the shelf', async () => {
  await open();
  await fireEvent.press(screen.getByRole('tab', { name: 'What I have' }));
  await fireEvent.changeText(screen.getByLabelText('How much Blended Scotch you have, in ml'), '300');
  expect(screen.getByLabelText('300 ml, Blended Scotch')).toBeTruthy();
});

test('a freezer Martini at 30% slushes at -18 and stays liquid at -12', async () => {
  await open(martini, ['Stir']);
  expect(screen.getByText('Will slush in a \u221218\u00a0°C freezer')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Your freezer: \u221218\u00a0°C. Change' }));
  await fireEvent.press(screen.getByRole('radio', { name: '\u221212\u00a0°C' }));
  expect(screen.getByText('Stays liquid in a \u221212\u00a0°C freezer')).toBeTruthy();
});

test('making it turns the bottle into a checklist', async () => {
  await renderWithTamagui(<BatchSheet visible onClose={() => {}} name="Penicillin" lines={penicillin} methodNames={["Shake"]} lockedUntil={null} initialServes={12} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Make it, tick as I go' }));
  const scotch = screen.getByRole('checkbox', { name: '720 ml, Blended Scotch' });
  await fireEvent.press(scotch);
  expect(screen.getByRole('checkbox', { name: '720 ml, Blended Scotch', checked: true })).toBeTruthy();
});

test('types up to the 6,969 cap', async () => {
  await open(martini, ['Stir']);
  await fireEvent.changeText(screen.getByDisplayValue('12'), '7000');
  expect(screen.getByLabelText('Number of serves').props['aria-valuenow']).toBe(6969);
  expect(screen.getByLabelText('523 L, London Dry Gin')).toBeTruthy();
});
