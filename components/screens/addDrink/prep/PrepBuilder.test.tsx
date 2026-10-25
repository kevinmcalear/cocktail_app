import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { startPrep } from '@/lib/prepKinds';

import { PrepBuilder } from './PrepBuilder';

// The paper band's View as pill reads the signed-in person's prefs; off here.
jest.mock('@/components/ViewAsBanner', () => ({ ViewAsPill: () => null }));
jest.mock('@/hooks/useKit', () => ({ useKit: () => ({ owned: [], kit: new Set(), toggle: jest.fn() }) }));
const mockAdd = jest.fn();
jest.mock('@/hooks/useBarKit', () => ({ useMakingKit: () => ({ kit: new Set(['whipper']), where: 'My Bar', add: mockAdd }) }));
// The catalog's sourced recipes: only Grapefruit cordial has one here.
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
              { id: 'ca', name: 'Citric acid', amount: 10, unit: 'g', note: null, optional: false },
            ],
            card: {
              prep: { yield_amount: 780, yield_unit: 'ml', shelf_life_hours: null, lead_time_minutes: null, lead_time_note: null, storage: 'Fridge, sealed bottle', actions: ['Syrup'] },
              steps: [{ position: 0, body: 'Warm the juice with the sugar until it dissolves.', timer_seconds: null }],
            },
            checkedOn: ['https://www.starchefs.com/recipes/grapefruit-americano', 'https://sunset.com/recipe/ruby-dove'],
          }
        : null,
  }),
}));

// The builder draws after its first layout, as the wizard does on iOS.
const laidOut = () => fireEvent(screen.getByTestId('add-prep'), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });
const open = async (name: string, onDone = jest.fn(), onLater?: () => void) => {
  await renderWithTamagui(<PrepBuilder name={name} drinkName="Daiquiri" ingredients={[]} onDone={onDone} onLater={onLater} onClose={jest.fn()} />);
  await laidOut();
  return onDone;
};

describe('PrepBuilder', () => {
  test('a technique name is picked under its kind, with its way lit; Skip goes on to the recipe', async () => {
    await open('Coconut fat washed white rum');
    expect(screen.getByRole('radio', { name: /^Wash, /, checked: true })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /^Fat wash\. Overnight\. Nothing special/, checked: true })).toBeTruthy();
    expect(screen.getByText('Fat fills in the method: mix, rest, freeze, strain.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.getByText('What goes in?')).toBeTruthy();
    expect(screen.getByText('White rum')).toBeTruthy();
    expect(screen.getByText('Coconut Oil')).toBeTruthy();
    expect(screen.getByText('Taken out before bottling')).toBeTruthy();
  });

  test('How? puts the kit first, dims the rest with I have this, and Every technique opens the library', async () => {
    await open('Miso banana liqueur');
    expect(screen.getByText('How? With your kit')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /^Rapid nitrous infusion\. 2 min\. / })).toBeTruthy();
    expect(screen.getByText('Needs kit you haven’t added')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^I have this: add Sous vide circulator/ }));
    expect(mockAdd).toHaveBeenCalledWith(['sous-vide']);
    await fireEvent.press(screen.getByRole('button', { name: 'Every technique' }));
    expect(screen.getByText('Search techniques')).toBeTruthy();
    // Something else is every technique; picking one there starts from it.
    await fireEvent.press(screen.getByRole('radio', { name: /^Something else, / }));
    expect(screen.getByText('Something else: every technique')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: /^Tepache\. / }));
    expect(screen.getByRole('radio', { name: /^Tepache\. /, checked: true })).toBeTruthy();
  });

  test('an oil is made from its own parts, not the spirit the infusion started with', async () => {
    await open('Chamomile infusion');
    await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.getByRole('button', { name: 'Pick the spirit' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await fireEvent.press(screen.getByRole('radio', { name: /^Herb, chile and garlic oils\. / }));
    await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.getByText('Neutral oil')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pick the spirit' })).toBeNull();
  });

  test('a clarified juice is its own kind, made the first way the kit covers', async () => {
    await open('Clarified grapefruit');
    expect(screen.getByRole('radio', { name: /^Clarified, /, checked: true })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /^Agar freeze-thaw\. 1 to 2 days\. Nothing special/ })).toBeTruthy();
  });

  test('a stand-in has to be picked or taken out before it can be added', async () => {
    const onDone = await open('Fat-washed rum');
    await fireEvent.press(screen.getByRole('button', { name: 'Next: what goes in' }));
    expect(screen.getByRole('button', { name: 'Pick the fat' })).toBeTruthy();
    expect(screen.getByText('Pick the fat, or take it out, to go on.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next: how it’s made' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Next: how it’s made' }));
    expect(screen.getByText('What goes in?')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Remove Melted fat' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next: how it’s made' }));
    expect(screen.getByText('About 2 weeks')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Add it to Daiquiri' }));
    const prep = onDone.mock.calls[0][0];
    expect(prep.technique).toBe('fat-wash');
    expect(prep.lines.map((l: { name: string }) => l.name)).toEqual(['Rum']);
    expect(prep.lines.some((l: { slot?: string }) => l.slot)).toBe(false);
  });

  test('a shrub: back to the drink, How? with its ways, what it takes, then tiles and steps; Later leaves it', async () => {
    const onLater = jest.fn();
    const onDone = await open('Pineapple chili shrub', jest.fn(), onLater);
    expect(screen.getByRole('button', { name: 'Back to Daiquiri' })).toBeTruthy();
    expect(screen.getByText('New prep · 1 of 3')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /^Cold\. 3 days · Jar, fine strainer · brighter fruit/, checked: true })).toBeTruthy();
    expect(screen.getByText('300 g pineapple')).toBeTruthy();
    expect(screen.getByText('300 g white sugar, 300 g apple cider vinegar, 2 whole fresno chili')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: /^Oleo shrub/ }));
    expect(screen.getByRole('radio', { name: /^Oleo shrub/, checked: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'All steps' }));
    expect(screen.getByText('1. Muddle the fruit, and any citrus peel, with the sugar.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Next: what goes in' }));
    expect(screen.getByText('Daiquiri › New prep · 2 of 3')).toBeTruthy();
    expect(screen.getByText('OLEO SHRUB · EQUAL PARTS BY WEIGHT')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Allergens: none/ }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Sulphites' }));
    // The chili starts with the canvas's note (make-create-prep-recipe); it can still be changed.
    await fireEvent.press(screen.getByRole('button', { name: 'Note on Fresno chili: Sliced, seeds in for more heat. Change it' }));
    await fireEvent.changeText(screen.getByLabelText('Note on Fresno chili'), 'Sliced, seeds in');
    await fireEvent.press(screen.getByRole('button', { name: 'Next: how it’s made' }));
    expect(screen.getByText('Suggested for an oleo shrub. Tap one to change it.')).toBeTruthy();
    expect(screen.getByText('Start from a step or write your own. A time you write becomes a timer when you make it.')).toBeTruthy();
    expect(screen.getByText('1 day')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Store: Fridge/ }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Freezer' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add it to Daiquiri' }));
    const prep = onDone.mock.calls[0][0];
    expect(prep.way).toBe('oleo');
    expect(prep.storage).toBe('Freezer');
    expect(prep.allergens).toEqual(['sulphites']);
    expect(prep.allergensSet).toBe(true);
    expect(prep.lines.find((l: { name: string }) => l.name === 'Fresno chili').note).toBe('Sliced, seeds in');
    expect(onLater).not.toHaveBeenCalled();
  });

  test('a name the catalog has a sourced recipe for opens on that recipe, with where it comes from', async () => {
    const onDone = await open('Grapefruit cordial');
    expect(screen.getByText('What goes in?')).toBeTruthy();
    expect(screen.getByText('Started from the catalog recipe, checked on starchefs.com and sunset.com. Change anything.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Next: how it’s made' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add it to Daiquiri' }));
    const prep = onDone.mock.calls[0][0];
    expect(prep.lines.map((l: { id: string }) => l.id)).toEqual(['gj', 'su', 'ca']);
    expect(prep.steps.map((s: { body: string }) => s.body)).toEqual(['Warm the juice with the sugar until it dissolves.']);
  });

  test('Later on the first step leaves the recipe for later', async () => {
    const onLater = jest.fn();
    await open('Lime cordial', jest.fn(), onLater);
    await fireEvent.press(screen.getByRole('button', { name: 'Later' }));
    expect(onLater).toHaveBeenCalled();
  });

  test('the name can change on What is it, and the prep is added under it', async () => {
    const onDone = await open('Lime cordial');
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Makrut lime cordial');
    await fireEvent.press(screen.getByRole('button', { name: 'Next: what goes in' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next: how it’s made' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add a step: Strain' }));
    expect(screen.getByLabelText(/^Step \d+$/).props.value).toBe('Strain through a fine sieve.');
    await fireEvent.press(screen.getByRole('button', { name: 'Add it to Daiquiri' }));
    expect(onDone.mock.calls[0][1]).toBe('Makrut lime cordial');
    expect(onDone.mock.calls[0][0].steps.at(-1).body).toBe('Strain through a fine sieve.');
  });

  test('a recipe already written keeps what goes in when another kind is picked', async () => {
    const onDone = jest.fn();
    await renderWithTamagui(<PrepBuilder name="Pineapple shrub" drinkName="Daiquiri" initial={startPrep('shrub', 'Pineapple shrub')} first ingredients={[]} onDone={onDone} onClose={jest.fn()} />);
    await laidOut();
    await fireEvent.press(screen.getByRole('radio', { name: /^Syrup, / }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next: what goes in' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next: how it’s made' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add it to Daiquiri' }));
    expect(onDone.mock.calls[0][0].kind).toBe('syrup');
    expect(onDone.mock.calls[0][0].lines.map((l: { name: string }) => l.name)).toEqual(['Pineapple', 'White sugar', 'Apple cider vinegar']);
  });
});
