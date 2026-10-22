import { act, fireEvent, screen } from '@testing-library/react-native';

import { BackbarTheme } from '@/components/ds';
import { renderWithTamagui } from '@/jest.setup';
import { nothingMade } from '@/lib/importReview';
import { useImportReview } from '@/store/useImportReview';

import { ImportReview } from './ImportReview';

const mockReplace = jest.fn();
const mockApprove = jest.fn();
const mockFinish = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: mockReplace }) }));
jest.mock('@/hooks/useBulk', () => ({ useSpecCatalog: () => ({ catalog: [], aliases: [], methods: [], glasses: [], isLoading: false }) }));
jest.mock('@/hooks/useDropdowns', () => ({ useDropdowns: () => ({ data: { iceTypes: [] } }) }));
jest.mock('@/hooks/useBarGlassware', () => ({ ...jest.requireActual('@/hooks/useBarGlassware'), useBarGlassware: () => ({ data: [] }) }));
jest.mock('@/hooks/useBringInMatchData', () => ({ useBringInMatchData: () => ({ catalog: [], aliases: [], venueId: null, library: [], shelf: [] }) }));
jest.mock('@/hooks/useBringInSave', () => ({
  useApproveDrink: () => ({ mutateAsync: mockApprove, isPending: false }),
  useBringInSave: () => ({ mutate: mockFinish, isPending: false, error: null }),
}));

const recipe = (name: string) => ({ name, by: null, lines: [{ amount: 45, unit: 'ml', ingredient: 'Calvados', unsure: false }], method: null, glass: null, ice: null, garnish: null, notes: null });

test('approve saves a drink as it goes; once every drink is checked, the approved ones are recorded as one bring-in', async () => {
  mockApprove.mockResolvedValue({ ...nothingMade(), itemIds: ['d1'], drinkIds: ['d1'] });
  mockFinish.mockImplementation((_input, { onSuccess }) => onSuccess({ batchId: 'b1' }));
  const onLeave = jest.fn();
  const id = useImportReview.getState().begin({ barId: null, title: 'Little Rye spec book', source: 'From a PDF', from: 'From a PDF', recipes: [recipe('Orchard Fizz'), recipe('Smoke Signal')], files: [] });
  const Live = () => {
    const review = useImportReview((s) => s.reviews[id]);
    return review ? <ImportReview review={review} onLeave={onLeave} /> : null;
  };
  await renderWithTamagui(
    <BackbarTheme>
      <Live />
    </BackbarTheme>
  );
  expect(screen.getByText('Drink 1 of 2')).toBeTruthy();
  expect(screen.getByText('0 of 2')).toBeTruthy();

  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Approve' })));
  expect(mockApprove).toHaveBeenCalledTimes(1);
  expect(mockApprove.mock.calls[0][0].draft.name).toBe('Orchard Fizz');
  // Saved, and on to the next one; the review remembers it.
  expect(screen.getByText('Drink 2 of 2')).toBeTruthy();
  expect(screen.getByText('1 of 2')).toBeTruthy();
  expect(useImportReview.getState().reviews[id].marks).toEqual(['approved', 'waiting']);
  expect(mockFinish).not.toHaveBeenCalled();

  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Skip' })));
  const [[input]] = mockFinish.mock.calls;
  expect(input).toMatchObject({ kind: 'recipes', drinks: [], title: 'Little Rye spec book', made: { drinkIds: ['d1'] } });
  expect(mockReplace).toHaveBeenCalledWith('/bring-in/done?batch=b1');
  expect(useImportReview.getState().reviews[id]).toBeUndefined();
});

test('Finish later leaves the rest waiting', async () => {
  const onLeave = jest.fn();
  const id = useImportReview.getState().begin({ barId: 'bar', title: '2 recipes', source: 'Pasted', from: 'From pasted text', recipes: [recipe('Low Tide'), recipe('Ash Garden')], files: [] });
  await renderWithTamagui(
    <BackbarTheme>
      <ImportReview review={useImportReview.getState().reviews[id]} onLeave={onLeave} />
    </BackbarTheme>
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Finish later' }));
  expect(onLeave).toHaveBeenCalled();
  expect(useImportReview.getState().reviews[id].marks).toEqual(['waiting', 'waiting']);
});
