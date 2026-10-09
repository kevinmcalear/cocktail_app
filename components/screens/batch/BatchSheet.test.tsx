import { fireEvent, screen } from '@testing-library/react-native';
import 'react-native-gesture-handler/jestSetup';

import { renderWithTamagui } from '@/jest.setup';
import { specLines } from '@/lib/spec';
import { useSettingsStore } from '@/store/useSettingsStore';

import { BatchSheet } from './BatchSheet';

jest.mock('@/components/tools/ToolsSheet', () => ({ ToolsSheet: () => null }));

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
  expect(screen.getByLabelText('In the bottle: 990 ml, 2 × 750 ml bottles')).toBeTruthy();
  expect(screen.getByText('Bottle 29% ABV')).toBeTruthy();
  expect(screen.queryByText('Will slush')).toBeNull();
});

test('fills a bottle: 12 Penicillins to a litre', async () => {
  await open();
  await fireEvent.press(screen.getByRole('tab', { name: 'Fill a bottle' }));
  await fireEvent.press(screen.getByRole('radio', { name: '1 L' }));
  expect(screen.getByLabelText('In the bottle: 990 ml, 1 × 1 L bottle')).toBeTruthy();
});

test('starts from what is on the shelf', async () => {
  await open();
  await fireEvent.press(screen.getByRole('tab', { name: 'What I have' }));
  await fireEvent.changeText(screen.getByLabelText('How much Blended Scotch you have, in ml'), '300');
  expect(screen.getByLabelText('300 ml, Blended Scotch')).toBeTruthy();
});

test('a freezer Martini at 30% slushes at -18 and stays liquid at -12', async () => {
  await open(martini, ['Stir']);
  expect(screen.getByText('Will slush')).toBeTruthy();
  await fireEvent.press(screen.getByRole('radio', { name: '\u221212\u00a0°C' }));
  expect(screen.getByText('Stays liquid')).toBeTruthy();
});
