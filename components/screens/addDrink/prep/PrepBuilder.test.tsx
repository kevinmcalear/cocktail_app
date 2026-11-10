import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';
import { startPrep } from '@/lib/prepKinds';

import { PrepBuilder } from './PrepBuilder';

// View as pill reads the signed-in person's prefs; off here.
jest.mock('@/components/ViewAsBanner', () => ({ ViewAsPill: () => null }));
jest.mock('@/hooks/useNearIngredients', () => ({ useNearIngredients: () => [], useNearIngredientsChecked: () => ({ near: [], checking: false }) }));
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
const open = async (name: string, onDone = jest.fn()) => {
  await renderWithProviders(<PrepBuilder name={name} ingredients={[]} onDone={onDone} onClose={jest.fn()} />);
  await laidOut();
  return onDone;
};

describe('PrepBuilder', () => {
  test('a technique name starts from that technique: Next goes on to its recipe', async () => {
    await open('Coconut fat washed white rum');
    await fireEvent.press(screen.getByRole('button', { name: 'Next: what goes in' }));
    expect(screen.getByText('What goes in?')).toBeTruthy();
    expect(screen.getByText('White rum')).toBeTruthy();
    expect(screen.getByText('Coconut Oil')).toBeTruthy();
    expect(screen.getByText('Taken out before bottling')).toBeTruthy();
  });

  test('How? puts the kit first, dims the rest with I have this, and Every technique opens the library', async () => {
    await open('Miso banana liqueur');
    expect(screen.getByText('HOW? YOUR KIT FIRST')).toBeTruthy();
    expect(screen.getByText('Your kit is in My Bar. The rest stay here, dimmed, in case you have it.')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /^Rapid nitrous infusion\. 2 min\. / })).toBeTruthy();
    // Each way that needs kit says so on its own row (board Add-house), with no grades.
    expect(screen.getAllByText('Needs kit you haven’t added').length).toBeGreaterThan(0);
    expect(screen.queryByText('A')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /^I have this: add Sous vide circulator/ }));
    expect(mockAdd).toHaveBeenCalledWith(['sous-vide']);
    await fireEvent.press(screen.getByRole('button', { name: 'Every technique' }));
    expect(screen.getByText('Search techniques')).toBeTruthy();
    // Something else is every technique; picking one there starts from it.
    // Five kinds and More (Kevin, 8 Nov); More shows the rest.
    expect(screen.queryByRole('radio', { name: 'Something else' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'More' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Something else' }));
    expect(screen.getByText('Something else: every technique')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: /^Tepache\. / }));
    expect(screen.getByRole('radio', { name: /^Tepache\. /, checked: true })).toBeTruthy();
  });

  test('an oil is made from its own parts, not the spirit the infusion started with', async () => {
    await open('Chamomile infusion');
    await fireEvent.press(screen.getByRole('button', { name: 'Next: what goes in' }));
    expect(screen.getByRole('button', { name: 'Pick the spirit' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await fireEvent.press(screen.getByRole('radio', { name: /^Herb, chile and garlic oils\. / }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next: what goes in' }));
    expect(screen.getByText('Neutral oil')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pick the spirit' })).toBeNull();
  });

  test('a clarified juice is its own kind, made the first way the kit covers', async () => {
    await open('Clarified grapefruit');
    expect(screen.getByRole('radio', { name: 'Clarified', checked: true })).toBeTruthy();
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
    await fireEvent.press(screen.getByRole('button', { name: 'Save it' }));
    const prep = onDone.mock.calls[0][0];
    expect(prep.technique).toBe('fat-wash');
    expect(prep.lines.map((l: { name: string }) => l.name)).toEqual(['Rum']);
    expect(prep.lines.some((l: { slot?: string }) => l.slot)).toBe(false);
  });

  test('a shrub: How? with its ways, what it takes, then tiles and steps', async () => {
    const onDone = await open('Pineapple chili shrub');
    expect(screen.getByText(/1 of 3$/i)).toBeTruthy();
    expect(screen.getByRole('radio', { name: /^Cold\. 3 days · Jar, fine strainer · brighter fruit/, checked: true })).toBeTruthy();
    // No amounts box on What is it (Kevin, 9 Nov: "Build as drawn"): what goes in is the next step.
    expect(screen.queryByText('300 g pineapple')).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: /^Oleo shrub/ }));
    expect(screen.getByRole('radio', { name: /^Oleo shrub/, checked: true })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Next: what goes in' }));
    expect(screen.getByText(/2 of 3$/i)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Allergens\. None found/ }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Sulphites' }));
    // The chili starts with the canvas's note (make-create-prep-recipe); it can still be changed.
    await fireEvent.press(screen.getByRole('button', { name: 'Note on Fresno chili: Sliced, seeds in for more heat. Change it' }));
    await fireEvent.changeText(screen.getByLabelText('Note on Fresno chili'), 'Sliced, seeds in');
    await fireEvent.press(screen.getByRole('button', { name: 'Next: how it’s made' }));
    expect(screen.getByText('Suggested for an oleo shrub. Tap one to change it.')).toBeTruthy();
    expect(screen.getByText('Start from a step or write your own. A time you write becomes a timer when you make it.')).toBeTruthy();
    expect(screen.getByText('1 day')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Store\. Fridge/ }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Freezer' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save it' }));
    const prep = onDone.mock.calls[0][0];
    expect(prep.way).toBe('oleo');
    expect(prep.storage).toBe('Freezer');
    expect(prep.allergens).toEqual(['sulphites']);
    expect(prep.allergensSet).toBe(true);
    expect(prep.lines.find((l: { name: string }) => l.name === 'Fresno chili').note).toBe('Sliced, seeds in');
  });

  test('a name the catalog has a sourced recipe for opens on that recipe, with where it comes from', async () => {
    const onDone = await open('Grapefruit cordial');
    expect(screen.getByText('What goes in?')).toBeTruthy();
    expect(screen.getByText('Started from the catalog recipe, checked on starchefs.com and sunset.com. Change anything.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Next: how it’s made' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save it' }));
    const prep = onDone.mock.calls[0][0];
    expect(prep.lines.map((l: { id: string }) => l.id)).toEqual(['gj', 'su', 'ca']);
    expect(prep.steps.map((s: { body: string }) => s.body)).toEqual(['Warm the juice with the sugar until it dissolves.']);
  });

  test('the name can change on What is it, and the prep is added under it', async () => {
    const onDone = await open('Lime cordial');
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Makrut lime cordial');
    await fireEvent.press(screen.getByRole('button', { name: 'Next: what goes in' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next: how it’s made' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add a step: Strain' }));
    expect(screen.getByLabelText(/^Step \d+$/).props.value).toBe('Strain through a fine sieve.');
    await fireEvent.press(screen.getByRole('button', { name: 'Save it' }));
    expect(onDone.mock.calls[0][1]).toBe('Makrut lime cordial');
    expect(onDone.mock.calls[0][0].steps.at(-1).body).toBe('Strain through a fine sieve.');
  });

  test('Something else on a name that says nothing about how it is made starts with no lines; none are guessed from its words', async () => {
    await open('Qz fresh ginger juice');
    await fireEvent.press(screen.getByRole('button', { name: 'More' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Something else' }));
    // No lines yet must not stop the first step going on.
    expect(screen.getByRole('button', { name: /^Next/ })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Next: what goes in' }));
    for (const word of ['Qz', 'Fresh', 'Ginger', 'Juice']) expect(screen.queryByText(word)).toBeNull();
    expect(startPrep('other', 'Qz fresh ginger juice').lines).toEqual([]);
    // A name with a kind still starts from it.
    expect(startPrep('syrup', 'Honey syrup').lines.length).toBeGreaterThan(0);
  });
});
