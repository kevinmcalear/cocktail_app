import { act, fireEvent, renderHook, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { dropInto } from '@/lib/batchLines';
import { EMPTY_DRAFT, newLine, type WizardDraft } from '@/lib/drinkWizard';

import { IngredientsStep } from './IngredientsStep';
import { useLineBatches } from './useLineBatches';

jest.mock('@/components/ViewAsBanner', () => ({ ViewAsPill: () => null }));
jest.mock('@/hooks/usePairings', () => ({ usePairings: () => ({ data: [] }) }));
jest.mock('@/hooks/useClosestClassic', () => ({ useClosestClassic: () => ({ data: null }) }));
jest.mock('@/hooks/useIngredientUse', () => ({ useIngredientUse: () => ({ data: 0 }) }));
jest.mock('@/hooks/useDiscover', () => ({ useDrinkLists: () => ({ data: [] }) }));
jest.mock('@/hooks/useStartFromClassic', () => ({ useStartFromClassic: () => ({ mutate: jest.fn(), isPending: false }) }));
jest.mock('@/hooks/useKit', () => ({ useKit: () => ({ owned: [], kit: new Set(), toggle: jest.fn() }) }));
jest.mock('@/hooks/usePrepCard', () => ({ ...jest.requireActual('@/hooks/usePrepCard'), useCatalogRecipe: () => ({ data: null }) }));

const ashGarden = (): WizardDraft => ({
  ...EMPTY_DRAFT,
  name: 'Ash Garden',
  lines: [newLine({ id: 'mezcal', name: 'Mezcal' }, 'ml', '45'), newLine({ id: 'agave', name: 'Agave syrup' }, 'ml', '15'), newLine({ id: 'lime', name: 'Lime juice' }, 'ml', '22.5')],
});

describe('drop one line on another to make a batch', () => {
  test('held over another line for a moment, a dropped line batches with it; a quick pass reorders', async () => {
    jest.useFakeTimers();
    const set = jest.fn();
    const draft = ashGarden();
    const notice = jest.fn();
    const { result } = await renderHook(() => useLineBatches({ draft, set, enabled: true, heights: () => [80, 80, 80], onNotice: notice }));

    // Agave passes over mezcal and is let go at once: no batch.
    await act(async () => result.current.over(1, -80));
    expect(result.current.drop(1)).toBe(false);

    // Agave held over mezcal: it lights up, and letting go batches them.
    await act(async () => result.current.over(1, 0));
    await act(async () => result.current.over(1, -80));
    await act(async () => jest.advanceTimersByTime(800));
    expect(result.current.target).toBe(0);
    let merged = false;
    await act(async () => {
      merged = result.current.drop(1);
    });
    expect(merged).toBe(true);
    const lines = set.mock.calls[0][0].lines;
    expect(lines.map((l: { name: string; amount: string }) => [l.name, l.amount])).toEqual([['Ash Garden batch', '60'], ['Lime juice', '22.5']]);
    // Its sheet opens on the new batch.
    expect(result.current.sheet.fresh).toBe(true);
    jest.useRealTimers();
  });

  test('the batch line reads as one pour; its sheet shows the bottle and splits it back', async () => {
    const set = jest.fn();
    const base = ashGarden();
    const lines = dropInto(base.lines, base.lines[1].key, base.lines[0].key, 'Ash Garden');
    await renderWithTamagui(<IngredientsStep draft={{ ...base, lines }} set={set} ingredients={[]} />);

    expect(screen.getByText('Ash Garden batch')).toBeTruthy();
    expect(screen.getByText('Batch · mezcal, agave syrup')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Ash Garden batch, / }));
    await fireEvent.press(screen.getByRole('button', { name: 'Open Ash Garden batch' }));

    expect(screen.getByText('BATCH · FROM ASH GARDEN')).toBeTruthy();
    expect(screen.getByText('562.5 ml')).toBeTruthy();
    expect(screen.getByText('187.5 ml')).toBeTruthy();
    expect(screen.getByText('about 12 drinks')).toBeTruthy();
    // Per drink only when asked.
    expect(screen.queryByText('45 ml')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Per drink amounts' }));
    expect(screen.getByText('45 ml')).toBeTruthy();

    // A litre bottle: the same ratio.
    await fireEvent.press(screen.getByRole('radio', { name: '1 L' }));
    expect(screen.getByText('250 ml')).toBeTruthy();
    expect(screen.getByText('Makes 1000 ml')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Split back into lines' }));
    expect(set.mock.calls.at(-1)[0].lines.map((l: { name: string; amount: string }) => [l.name, l.amount])).toEqual([
      ['Mezcal', '45'],
      ['Agave syrup', '15'],
      ['Lime juice', '22.5'],
    ]);
  });
});
