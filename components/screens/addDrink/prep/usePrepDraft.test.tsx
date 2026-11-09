import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';
import { startPrep, type PrepDraft } from '@/lib/prepKinds';

import { PrepBuilder } from './PrepBuilder';

// The draft's kind and way picks (usePrepDraft), through the builder that writes it.
jest.mock('@/components/ViewAsBanner', () => ({ ViewAsPill: () => null }));
jest.mock('@/hooks/useNearIngredients', () => ({ useNearIngredients: () => [], useNearIngredientsChecked: () => ({ near: [], checking: false }) }));
jest.mock('@/hooks/useKit', () => ({ useKit: () => ({ owned: [], kit: new Set(), toggle: jest.fn() }) }));
jest.mock('@/hooks/useBarKit', () => ({ useMakingKit: () => ({ kit: new Set(), where: 'My Bar', add: jest.fn() }) }));
// Only Grapefruit cordial has a sourced recipe in the catalog here.
jest.mock('@/hooks/usePrepCard', () => ({
  ...jest.requireActual('@/hooks/usePrepCard'),
  useCatalogRecipe: (name: string | null) => ({
    data:
      name === 'Grapefruit cordial'
        ? {
            id: 'gc',
            name: 'Grapefruit cordial',
            lines: [
              { id: 'gj', name: 'Grapefruit juice', amount: 500, unit: 'g', note: null, optional: false },
              { id: 'su', name: 'Sugar', amount: 450, unit: 'g', note: null, optional: false },
            ],
            card: { prep: null, steps: [{ position: 0, body: 'Warm the juice with the sugar until it dissolves.', timer_seconds: null }] },
            checkedOn: ['https://www.starchefs.com/recipes/grapefruit-americano'],
          }
        : null,
  }),
}));

const laidOut = () => fireEvent(screen.getByTestId('add-prep'), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });
const next = async (...labels: string[]) => {
  for (const name of labels) await fireEvent.press(screen.getByRole('button', { name }));
};

// A draft picked up again (a kept one, or one already in the drink), another kind picked, and added.
const pickedUp = async (initial: PrepDraft, kind: string) => {
  const onDone = jest.fn();
  await renderWithProviders(<PrepBuilder name="Pineapple shrub" drinkName="Daiquiri" initial={initial} first ingredients={[]} onDone={onDone} onClose={jest.fn()} />);
  await laidOut();
  await fireEvent.press(screen.getByRole('radio', { name: kind }));
  await next('Next: what goes in', 'Next: how it’s made', 'Add it to Daiquiri');
  return onDone.mock.calls[0][0] as PrepDraft;
};

describe('usePrepDraft', () => {
  test('a recipe already written keeps what goes in when another kind is picked', async () => {
    const shrub = startPrep('shrub', 'Pineapple shrub');
    const prep = await pickedUp({ ...shrub, lines: [...shrub.lines, { key: 'g', id: null, name: 'Fresh ginger', parts: 0.2, unit: 'g', amount: '' }] }, 'Syrup');
    expect(prep.kind).toBe('syrup');
    expect(prep.lines.map((l) => l.name)).toEqual(['Pineapple', 'White sugar', 'Apple cider vinegar', 'Fresh ginger']);
  });

  test('a draft picked up again with only its kind’s own lines starts the new kind’s (review of #1183)', async () => {
    const prep = await pickedUp(startPrep('shrub', 'Pineapple shrub'), 'Syrup');
    expect(prep.kind).toBe('syrup');
    expect(prep.lines.map((l) => l.name)).toEqual(['Sugar', 'Water']);
  });

  test('another way of a syrup keeps a line added to what goes in, and takes the way’s steps (review of #1183)', async () => {
    const onDone = jest.fn();
    await renderWithProviders(<PrepBuilder name="Honey syrup" drinkName="Daiquiri" ingredients={[]} onDone={onDone} onClose={jest.fn()} />);
    await laidOut();
    await next('Next: what goes in');
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'Fresh ginger');
    await next('Just add the name “Fresh ginger”', 'Back');
    await fireEvent.press(screen.getByRole('radio', { name: /^Sous vide\./ }));
    await next('Next: what goes in', 'Next: how it’s made', 'Add it to Daiquiri');
    const prep = onDone.mock.calls[0][0] as PrepDraft;
    expect(prep.way).toBe('sous-vide');
    expect(prep.lines.map((l) => l.name)).toEqual(['Sugar', 'Water', 'Fresh ginger']);
    expect(prep.steps[0].body).toBe('Seal the sugar, the water and any flavour in a bag.');
  });

  test('on its own page a name typed there starts from the catalog’s recipe once typing pauses, and stays on the name (review of #1183)', async () => {
    const onDone = jest.fn();
    await renderWithProviders(<PrepBuilder page name="" drinkName="" above={[]} ingredients={[]} onDone={onDone} onKeep={jest.fn()} onClose={jest.fn()} />);
    await laidOut();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Grapefruit cordial');
    await act(() => new Promise((r) => setTimeout(r, 350)));
    expect(screen.getByText('What are you making?')).toBeTruthy();
    await next('Next: what goes in');
    expect(screen.getByText('Started from the catalog recipe, checked on starchefs.com. Change anything.')).toBeTruthy();
    await next('Next: how it’s made', 'Save it');
    expect(onDone.mock.calls[0][0].lines.map((l: { id: string }) => l.id)).toEqual(['gj', 'su']);
  });
});
