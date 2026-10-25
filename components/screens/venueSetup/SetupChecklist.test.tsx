import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { checklist } from '@/lib/setupChecklist';

import { SetupChecklist } from './SetupChecklist';

const [mockPush, mockSkip] = [jest.fn(), jest.fn()];
let mockRun: { finished: boolean } | undefined = { finished: true };

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/hooks/useBarGlassware', () => ({ useBarPageId: () => ({ data: 'page' }), useFlushHeldGlasses: () => {} }));
jest.mock('@/hooks/useSetupChecklist', () => ({
  useSetupChecklist: () => ({
    run: mockRun,
    list: jest.requireActual('@/lib/setupChecklist').checklist({ bar: true, kit: false, bottles: false, menu: true, drinks: false, team: false }, ['team']),
    notes: { menu: 'Autumn menu' },
    menuId: 'm1',
    loading: false,
    skip: mockSkip,
  }),
}));
jest.mock('./SetupChecklistParts', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    FromDrinksRow: () => null,
    ChecklistRow: ({ title, line, note, state, onPress }: { title: string; line: string; note?: string; state: string; onPress: () => void }) => (
      <Pressable role="button" accessibilityLabel={`${title}, ${state}`} onPress={onPress}>
        <Text>{[line, note].filter(Boolean).join(' · ')}</Text>
      </Pressable>
    ),
    ClaimNote: () => null,
  };
});
// The steps it opens in place: each hands back with Next, Done or Back.
jest.mock('./GlassesStep', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    GlassesStep: ({ step, onNext, onSkip }: { step: string; onNext: () => void; onSkip: () => void }) => (
      <>
        <Text>{step}</Text>
        <Pressable role="button" accessibilityLabel="Next" onPress={onNext} />
        <Pressable role="button" accessibilityLabel="Skip" onPress={onSkip} />
      </>
    ),
  };
});
jest.mock('./BrandsStep', () => ({ BrandsStep: () => null }));
jest.mock('./MenuStep', () => ({ MenuStep: () => null }));
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ data: [] }) }));
jest.mock('@/hooks/useKitFromDrinks', () => ({ useKitFromDrinks: () => null }));
jest.mock('./FromDrinksStep', () => ({ FromDrinksStep: () => null, fromDrinksCount: () => null }));
jest.mock('./TeamStep', () => ({ TeamStep: () => null }));

beforeEach(() => {
  mockRun = { finished: true };
  for (const m of [mockPush, mockSkip]) m.mockReset();
});

test('six rows, Kit next; Kit opens in place and comes back here', async () => {
  expect(checklist({ bar: true, kit: false, bottles: false, menu: true, drinks: false, team: false }, ['team']).next).toBe('kit');
  await renderWithTamagui(<SetupChecklist barId="b1" name="Little Rye" />);
  expect(screen.getByText('Set up Little Rye')).toBeTruthy();
  expect(screen.getByText('Two of six done. Each one brings you back here.')).toBeTruthy();
  for (const row of ['Your bar, done', 'Kit, now', 'Bottles, todo', 'First menu, done', 'First drinks, todo', 'Your team, skipped']) expect(screen.getByRole('button', { name: row })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Kit, now' }));
  expect(screen.getByText('Set up Little Rye · Kit')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByRole('button', { name: 'Kit, now' })).toBeTruthy();
  // Skip inside the step skips the row, and comes back here too.
  await fireEvent.press(screen.getByRole('button', { name: 'Kit, now' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
  expect(mockSkip).toHaveBeenCalledWith('kit');
  expect(screen.getByRole('button', { name: 'Kit, now' })).toBeTruthy();
});

test('pages it opens: Your bar (Venue settings once setup is through, else setup where it stopped) and the menu for First drinks', async () => {
  await renderWithTamagui(<SetupChecklist barId="b1" name="Little Rye" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Your bar, done' }));
  expect(mockPush).toHaveBeenLastCalledWith('/settings/bar/b1');
  await fireEvent.press(screen.getByRole('button', { name: 'First drinks, todo' }));
  expect(mockPush).toHaveBeenLastCalledWith('/menus/m1/edit');
});

test('setup not through yet: Your bar picks venue setup up', async () => {
  mockRun = { finished: false };
  await renderWithTamagui(<SetupChecklist barId="b1" name="Little Rye" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Your bar, done' }));
  expect(mockPush).toHaveBeenLastCalledWith('/venue-setup?bar=b1');
});
