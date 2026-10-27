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
jest.mock('@/hooks/useBarKit', () => ({ useBarKit: () => ({ data: [] }) }));
jest.mock('@/hooks/useMyProfile', () => ({ useMyProfile: () => ({ data: { displayName: 'Eddie Kim' } }) }));
const mockSetFresh = jest.fn();
jest.mock('@/hooks/useServiceSpec', () => ({ useSetPartFresh: () => ({ mutate: mockSetFresh, error: null }) }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: () => null, Path: () => null }));

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

// An Irish Coffee made in parts (board made-parts-making): the bottle holds part 1 only.
const irish = specLines([
  { ...line('w', 'Irish whiskey', 40, 'ml', 40), part: 1 },
  { ...line('c', 'Hot coffee', 120, 'ml', null, true), part: 1 },
  { ...line('d', 'Demerara syrup', 15, 'ml'), part: 1 },
  { ...line('k', 'Cream', 30, 'ml'), part: 2, preparation_notes: 'whip it until it just holds' },
]);
const irishParts = [
  { n: 1, name: 'The coffee', methods: ['Build'], how: 'Build in the glass', join: null },
  { n: 2, name: 'The cream', methods: ['Whip (whisk or frother)'], how: 'Whip with a whisk or frother', join: 'float' as const },
];
const creamFresh = [irishParts[0], { ...irishParts[1], fresh: true }];
const openIrish = (barId: string | null = 'bar', parts = creamFresh) =>
  renderWithTamagui(<BatchSheet visible onClose={jest.fn()} name="Irish Coffee" lines={irish} methodNames={['Build', 'Whip (whisk or frother)']} lockedUntil={null} initialServes={12} barId={barId} parts={parts} specLabel="House spec" itemId="irish" canEdit />);

test('a part made fresh: the bottle holds part 1 and the cream is made for each serve, as before', async () => {
  await openIrish();
  expect(screen.getByText('House spec · made in 2 parts')).toBeTruthy();
  expect(screen.getByText('IN THE BOTTLE · PART 1, THE COFFEE')).toBeTruthy();
  expect(screen.getByLabelText('480 ml, Irish whiskey')).toBeTruthy();
  expect(screen.queryByLabelText('360 ml, Cream')).toBeNull();
  expect(screen.getByLabelText('55 ml, Irish Coffee, from the bottle')).toBeTruthy();
  expect(screen.getByText('Made fresh for each serve: whip with a whisk or frother')).toBeTruthy();
  expect(screen.getByLabelText('30 ml, Cream')).toBeTruthy();
  expect(screen.getByLabelText('Then float it on top')).toBeTruthy();
  expect(screen.queryByText('IN ORDER')).toBeNull();
  // Whoever can edit the drink sets it back to made ahead, on the part's head.
  await fireEvent.press(screen.getByRole('radio', { name: 'Made ahead' }));
  expect(mockSetFresh).toHaveBeenCalledWith({ n: 2, fresh: false });
});

// Every part made ahead (board made-parts-making, approved 27 Oct 2026): the cream in its own container.
test('every part made ahead: the cream in its own container, poured from it at the station', async () => {
  await openIrish('bar', irishParts);
  expect(screen.getByText('House spec · made in 2 parts, both made ahead')).toBeTruthy();
  expect(screen.getByText('serves · every part scales')).toBeTruthy();
  expect(screen.getByLabelText('Number of serves')).toBeTruthy();
  expect(screen.getByText('IN ITS OWN CONTAINER · PART 2, THE CREAM')).toBeTruthy();
  expect(screen.getByLabelText('360 ml, Cream')).toBeTruthy();
  expect(screen.getByText('use by close tonight')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Container: 1 × 500 ml deli container, change' })).toBeTruthy();
  expect(screen.getByLabelText('55 ml, Irish Coffee, the coffee bottle')).toBeTruthy();
  expect(screen.getByText('From its container, already whipped')).toBeTruthy();
  expect(screen.getByLabelText('30 ml, Cream, the cream container')).toBeTruthy();
  for (const step of ['Pour 55 ml from the coffee bottle', 'Add 120 ml Hot coffee', 'Spoon 30 ml from the cream container', 'Float it on top']) expect(screen.getByText(step)).toBeTruthy();
  // One serves count scales every part.
  await fireEvent.changeText(screen.getByDisplayValue('12'), '24');
  expect(screen.getByLabelText('720 ml, Cream')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Container: 1 × 1 L deli container, change' })).toBeTruthy();
  // The container and use-by change on a tap.
  await fireEvent.press(screen.getByRole('button', { name: 'Container: 1 × 1 L deli container, change' }));
  await fireEvent.press(screen.getByRole('radio', { name: '500 ml deli container' }));
  expect(screen.getByRole('button', { name: 'Container: 2 × 500 ml deli container, change' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Use by: use by close tonight, change' }));
  await fireEvent.press(screen.getByRole('radio', { name: '1 day' }));
  expect(screen.queryByText('use by close tonight')).toBeNull();
  // Made fresh, on the part's head.
  await fireEvent.press(screen.getAllByRole('radio', { name: 'Made fresh' })[0]);
  expect(mockSetFresh).toHaveBeenCalledWith({ n: 2, fresh: true });
});

test('make now: a tick list and a label for each container', async () => {
  await openIrish('bar', irishParts);
  await fireEvent.press(screen.getByRole('button', { name: 'Make now' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: '360 ml, Cream' }));
  expect(screen.getByRole('checkbox', { name: '360 ml, Cream', checked: true })).toBeTruthy();
  expect(screen.getByRole('checkbox', { name: '480 ml, Irish whiskey' })).toBeTruthy();
  expect(screen.getAllByText(/^Irish Coffee · The (coffee|cream)$/)).toHaveLength(2);
});

test('at home, tick as I go makes every line part by part, the float last', async () => {
  await openIrish(null);
  await fireEvent.press(screen.getByRole('button', { name: 'Make it, tick as I go' }));
  expect(screen.getByText('At home · 12 serves')).toBeTruthy();
  expect(screen.getByText('PART 2 OF 2')).toBeTruthy();
  expect(screen.getByText('0 of 5 done')).toBeTruthy();
  await fireEvent.press(screen.getByRole('checkbox', { name: '1.44 L, Hot coffee' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Float it on top' }));
  expect(screen.getByText('2 of 5 done')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Done making' }));
  expect(screen.getByText('IN THE BOTTLE · PART 1, THE COFFEE')).toBeTruthy();
});
