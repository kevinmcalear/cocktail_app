import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { BackbarTheme } from '@/components/ds';
import { renderWithTamagui } from '@/jest.setup';
import { emptySummary } from '@/lib/bringInBatch';
import { startChoices } from '@/lib/bringInDraft';
import type { MatchData } from '@/lib/bringInMatch';
import { startReview } from '@/lib/importReview';
import type { RecipeReading } from '@/supabase/functions/_shared/anythingRead';
import { useBringIn } from '@/store/useBringIn';
import { useToastStore } from '@/store/useToastStore';

import { ImportReview } from './ImportReview';
import { ImportReviewDesk } from './ImportReviewDesk';

const mockSave = jest.fn();
const mockCreatePrep = jest.fn();
const mockRefresh = jest.fn((..._args: unknown[]) => Promise.resolve());
jest.mock('expo-router', () => ({ useIsFocused: () => true, useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }) }));
jest.mock('@/hooks/useBringInSave', () => ({ useBringInSave: () => ({ mutateAsync: mockSave }) }));
jest.mock('@/hooks/useBulk', () => ({ useSpecCatalog: () => ({ catalog: [], aliases: [], methods: [], glasses: [], isLoading: false }) }));
jest.mock('@/hooks/useSameNameDrink', () => ({ useSameNameDrink: () => ({ data: null }) }));
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ venues: [] }) }));
jest.mock('@/hooks/useDropdowns', () => ({ useDropdowns: () => ({ data: { iceTypes: [] } }), refreshIngredients: (...args: unknown[]) => mockRefresh(...args) }));
jest.mock('@tanstack/react-query', () => ({ ...jest.requireActual('@tanstack/react-query'), useQueryClient: () => ({}) }));
jest.mock('@/hooks/usePrepCard', () => ({ useCreatePrep: () => ({ mutateAsync: mockCreatePrep }) }));
jest.mock('@/hooks/useBarGlassware', () => ({ ...jest.requireActual('@/hooks/useBarGlassware'), useBarGlassware: () => ({ data: [] }) }));

const data: MatchData = { catalog: [], aliases: [], venueId: 'bar', library: [], shelf: [] };
const recipe = (name: string): RecipeReading => ({ name, by: null, lines: [{ amount: 30, unit: 'ml', ingredient: 'Pink grapefruit juice', unsure: false }], method: 'Shake, fine strain', glass: 'Coupe', ice: null, garnish: null, notes: null });
const recipes = ['Orchard Fizz', 'Smoke Signal', 'Low Tide'].map(recipe);

const ui = (node: React.ReactNode) => renderWithTamagui(<BackbarTheme>{node}</BackbarTheme>);
/** The app killed and opened again: memory gone, the store read back from what this device kept. */
async function relaunch() {
  const kept = await AsyncStorage.getItem('bring-in-reviews');
  await act(async () => useBringIn.setState({ reviews: {} }));
  await AsyncStorage.setItem('bring-in-reviews', kept!);
  await act(() => useBringIn.persist.rehydrate());
}
const saved = (id: string) => ({ batchId: 'b', kind: 'recipes', title: '', source: '', menuId: null, drinkIds: [id], summary: { ...emptySummary('recipes'), drinksNew: 1 }, createdAt: '', warnings: [] });

beforeEach(async () => {
  mockSave.mockReset();
  mockCreatePrep.mockReset();
  useToastStore.getState().hide();
  await AsyncStorage.clear();
  useBringIn.setState({ reviews: {}, reviewing: null, later: [] });
  useBringIn.getState().openReview(
    startReview({ id: 'r1', userId: 'u1', barId: 'bar', name: 'Little Rye spec book.pdf', source: 'a spec PDF', recipes, files: [], choices: recipes.map(startChoices), summary: emptySummary('recipes'), now: '2026-10-22T10:00:00.000Z' })
  );
});

test('Approve saves that one drink at once and moves on; it is never saved twice, even after the app is killed mid-save', async () => {
  let finish: (v: unknown) => void = () => {};
  mockSave.mockImplementationOnce(() => new Promise((done) => (finish = done)));
  await ui(<ImportReview id="r1" data={data} onFinishLater={jest.fn()} />);
  expect(screen.getByText('Drink 1 of 3')).toBeTruthy();
  expect(screen.getByText('0 of 3')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Approve' }));
  expect(mockSave).toHaveBeenCalledTimes(1);
  expect(mockSave.mock.calls[0][0]).toMatchObject({ kind: 'recipes', source: 'a spec PDF', drinks: [{ draft: { name: 'Orchard Fizz' } }] });
  // On to the next one while it saves; the first counts as approved already.
  expect(screen.getByText('Drink 2 of 3')).toBeTruthy();
  expect(screen.getByText('1 of 3')).toBeTruthy();
  expect(useBringIn.getState().reviews.r1.marks).toEqual(['saving', null, null]);

  // The app is killed before the save answers: what was kept comes back.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  const kept = await AsyncStorage.getItem('bring-in-reviews');
  expect(JSON.parse(kept!).state.reviews.r1.marks).toEqual(['saving', null, null]);
  await relaunch();
  const back = useBringIn.getState().reviews.r1;
  // Kept as approved (it may well be in the Library), never offered again, and said so.
  expect(back.marks).toEqual(['approved', null, null]);
  expect(back.unsure).toEqual([0]);
  useBringIn.getState().setReviewing('r1');
  await act(async () => finish(saved('d1')));
  await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
  expect(screen.getByText('Drink 3 of 3')).toBeTruthy();
  expect(mockSave).toHaveBeenCalledTimes(1);
});

test('an approved drink stays approved after the app is killed', async () => {
  mockSave.mockResolvedValueOnce(saved('d1'));
  await ui(<ImportReview id="r1" data={data} onFinishLater={jest.fn()} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Approve' }));
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(useBringIn.getState().reviews.r1.marks[0]).toBe('approved');
  await relaunch();
  const back = useBringIn.getState().reviews.r1;
  expect(back.marks).toEqual(['approved', null, null]);
  expect(back.drinkIds[0]).toBe('d1');
  expect(back.unsure).toEqual([]);
  expect(back.summary.drinksNew).toBe(1);
});

test('on a laptop the list shows what was approved and skipped, with the count beside the bar', async () => {
  mockSave.mockResolvedValueOnce(saved('d1'));
  await ui(<ImportReviewDesk id="r1" data={data} onFinishLater={jest.fn()} />);
  expect(screen.getByText('0 of 3 checked · 0 approved · 0 skipped')).toBeTruthy();
  expect(screen.getByText('3 DRINKS')).toBeTruthy();
  expect(screen.getByText('Shake, fine strain · coupe · drawn from the spec')).toBeTruthy();
  expect(screen.getByText('FROM YOUR FILE')).toBeTruthy();
  expect(screen.getByText('A approves · S skips · arrow keys move')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Approve and next' }));
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
  expect(screen.getByText('2 of 3 checked · 1 approved · 1 skipped')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Orchard Fizz, approved' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Smoke Signal, skipped' })).toBeTruthy();
  expect(screen.getByText('Drink 3 of 3')).toBeTruthy();
  // Back to the approved one: it can't be approved or skipped again.
  await fireEvent.press(screen.getByRole('button', { name: 'Orchard Fizz, approved' }));
  expect(screen.getByText('Approved. It’s in your Library.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Approve and next' }));
  expect(mockSave).toHaveBeenCalledTimes(1);
});

test('Skip, Edit and Approve are the pinned buttons; the link under the spec is gone', async () => {
  await ui(<ImportReview id="r1" data={data} onFinishLater={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Skip' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Edit this drink' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Approve' })).toBeTruthy();
  expect(screen.getAllByRole('button', { name: 'Edit this drink' })).toHaveLength(1);
});

test('something that is not a drink can be taken out, and Undo puts it back', async () => {
  await ui(<ImportReview id="r1" data={data} onFinishLater={jest.fn()} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Not a drink? Take it out' }));
  expect(screen.getByText('Orchard Fizz isn’t a drink?')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Take it out' }));
  expect(screen.getByText('Drink 1 of 2')).toBeTruthy();
  expect(useBringIn.getState().reviews.r1.recipes.map((r) => r.name)).toEqual(['Smoke Signal', 'Low Tide']);
  const toast = useToastStore.getState().toast!;
  expect(toast.title).toBe('Orchard Fizz taken out');
  await act(async () => toast.action!.onPress());
  expect(useBringIn.getState().reviews.r1.recipes.map((r) => r.name)).toEqual(['Orchard Fizz', 'Smoke Signal', 'Low Tide']);
  expect(screen.getByText('Drink 1 of 3')).toBeTruthy();
});

test('taking out the last drink to check ends the review, with no Undo to offer', async () => {
  useBringIn.getState().editReview('r1', (r) => ({ ...r, marks: ['skipped', 'skipped', null], at: 2 }));
  await ui(<ImportReview id="r1" data={data} onFinishLater={jest.fn()} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Not a drink? Take it out' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Take it out' }));
  expect(useToastStore.getState().toast?.action).toBeUndefined();
});

test('keeping it as house-made saves its recipe, takes it out and lists it as made', async () => {
  mockCreatePrep.mockResolvedValueOnce({ id: 'hsv', name: 'Orchard Fizz', warnings: [] });
  await ui(<ImportReview id="r1" data={data} onFinishLater={jest.fn()} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Not a drink? Take it out' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Keep it as house-made' }));
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(mockCreatePrep.mock.calls[0][0]).toMatchObject({ name: 'Orchard Fizz', barId: 'bar', prep: { kind: 'other', lines: [{ name: 'Pink grapefruit juice', parts: 30, unit: 'ml' }] } });
  expect(mockRefresh).toHaveBeenCalledWith(expect.anything(), ['hsv']);
  const review = useBringIn.getState().reviews.r1;
  expect(review.recipes.map((r) => r.name)).toEqual(['Smoke Signal', 'Low Tide']);
  expect(review.summary.preps).toEqual(['Orchard Fizz']);
  expect(useToastStore.getState().toast?.title).toBe('Orchard Fizz kept as house-made');
});

test('a save in flight still marks its own drink when an earlier one is taken out', async () => {
  let finish: (v: unknown) => void = () => {};
  mockSave.mockImplementationOnce(() => new Promise((done) => (finish = done)));
  useBringIn.getState().editReview('r1', (r) => ({ ...r, at: 1 }));
  await ui(<ImportReview id="r1" data={data} onFinishLater={jest.fn()} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Approve' }));
  // Back to the first, which isn't a drink.
  await act(async () => useBringIn.getState().editReview('r1', (r) => ({ ...r, at: 0 })));
  await fireEvent.press(screen.getByRole('button', { name: 'Not a drink? Take it out' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Take it out' }));
  await act(async () => finish(saved('d2')));
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  const review = useBringIn.getState().reviews.r1;
  expect(review.recipes.map((r) => r.name)).toEqual(['Smoke Signal', 'Low Tide']);
  expect(review.marks).toEqual(['approved', null]);
  expect(review.drinkIds[0]).toBe('d2');
});
