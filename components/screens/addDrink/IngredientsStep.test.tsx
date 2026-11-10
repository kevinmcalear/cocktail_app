import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { renderWithProviders } from '@/jest.setup';
import { combineLines } from '@/lib/batchLines';
import { EMPTY_DRAFT, newLine, type WizardDraft } from '@/lib/drinkWizard';
import { startPrep } from '@/lib/prepKinds';

import type { CatalogIngredient } from './IngredientSearch';
import { IngredientsStep } from './IngredientsStep';
import { LineRow } from './LineRow';

// Pairings come from the database; these tests are about the field.
// The paper band's View as pill reads the signed-in person's prefs; off here.
jest.mock('@/components/ViewAsBanner', () => ({ ViewAsPill: () => null }));
jest.mock('@/hooks/useNearIngredients', () => ({ useNearIngredients: () => [], useNearIngredientsChecked: () => ({ near: [], checking: false }) }));
jest.mock('@/hooks/usePairings', () => ({ usePairings: () => ({ data: [] }) }));
jest.mock('@/hooks/useClosestClassic', () => ({ useClosestClassic: () => ({ data: null }), useCloseClassics: () => ({ data: [] }) }));
jest.mock('@/hooks/useDiscover', () => ({ useDebounced: <T,>(v: T) => v, useDrinkLists: () => ({ data: [] }) }));
jest.mock('@/hooks/useStartFromClassic', () => ({ useStartFromClassic: () => ({ mutate: jest.fn(), isPending: false }) }));
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ venues: [] }) }));
jest.mock('@/hooks/useKit', () => ({ useKit: () => ({ owned: [], kit: new Set(), toggle: jest.fn() }) }));
jest.mock('@/hooks/useBarKit', () => ({ useMakingKit: () => ({ kit: new Set(), where: 'My Bar', add: jest.fn() }) }));
jest.mock('@/hooks/usePrepCard', () => ({ ...jest.requireActual('@/hooks/usePrepCard'), useCatalogRecipe: () => ({ data: null }) }));

jest.mock('@react-native-community/netinfo', () => ({ useNetInfo: () => ({ isConnected: true }) }));
jest.mock('@/hooks/useSameNamePrep', () => ({ ...jest.requireActual('@/hooks/useSameNamePrep'), useSameNamePrep: () => ({ data: null, checking: false }) }));

// The house-made's page lays out before it draws on iOS (KeyboardScreen).
const partLaidOut = () => fireEvent(screen.getAllByTestId('part-page').at(-1)!, 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });

const CAMPARI = { id: 'campari', name: 'Campari', item_images: [{ images: { url: 'https://example.test/campari.jpg' } }] };

// The draft as the wizard keeps it: a house-made's page opens once its line is there.
function Stateful({ draft: start, set, ingredients = [CAMPARI] }: { draft: WizardDraft; set: jest.Mock; ingredients?: CatalogIngredient[] }) {
  const [draft, setDraft] = useState(start);
  return (
    <IngredientsStep
      draft={draft}
      set={(c) => {
        set(c);
        setDraft((d) => ({ ...d, ...c }));
      }}
      ingredients={ingredients}
    />
  );
}

describe('IngredientsStep', () => {
  test('while the list loads, a typed name is never added as a new ingredient', async () => {
    const set = jest.fn();
    await renderWithProviders(<IngredientsStep draft={EMPTY_DRAFT} set={set} ingredients={[]} loading />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'Campari');

    expect(screen.getByText('Loading ingredients…')).toBeTruthy();
    expect(screen.queryByText('Just add the name')).toBeNull();
    await fireEvent(screen.getByLabelText('Add an ingredient'), 'submitEditing');
    expect(set).not.toHaveBeenCalled();
  });

  test('once loaded, it finds the bottle and still offers a new one', async () => {
    const set = jest.fn();
    await renderWithProviders(<IngredientsStep draft={EMPTY_DRAFT} set={set} ingredients={[CAMPARI]} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'camp');

    expect(screen.getByRole('button', { name: 'Just add the name “camp”' })).toBeTruthy();
    // Where it's from, under its name (board q16-2).
    expect(screen.getByText('In the catalog')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Campari' }));
    expect(set.mock.calls[0][0].lines[0]).toMatchObject({ id: 'campari', name: 'Campari' });
  });

  test('a pour typed before the name is the line\'s: "30ml camp" finds Campari at 30 ml, "1/2 pommeau" adds a new one', async () => {
    const set = jest.fn();
    await renderWithProviders(<IngredientsStep draft={EMPTY_DRAFT} set={set} ingredients={[CAMPARI]} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), '30ml camp');
    expect(screen.getByText('30 ml of the one you pick')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Campari' }));
    expect(set.mock.calls[0][0].lines[0]).toMatchObject({ id: 'campari', name: 'Campari', amount: '30', unit: 'ml' });

    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), '1/2 pommeau');
    await fireEvent(screen.getByLabelText('Add an ingredient'), 'submitEditing');
    expect(set.mock.calls[1][0].lines[0]).toMatchObject({ id: null, name: 'pommeau', amount: '0.5' });
  });

  test('a prep the shelf lacks is made in house: its line first, then one flat page inside the drink; Done gives the line its recipe', async () => {
    const set = jest.fn();
    await renderWithProviders(<Stateful draft={EMPTY_DRAFT} set={set} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'Clarified grapefruit');

    await fireEvent.press(screen.getByRole('button', { name: 'Make “Clarified grapefruit” in-house' }));
    // The line comes first (board Add-inside, 1): the drink keeps it, a recipe to write, before anything is written.
    expect(set.mock.calls[0][0].lines[0]).toMatchObject({ id: null, name: 'Clarified grapefruit', later: true });
    await partLaidOut();
    expect(screen.getByText('HOUSE-MADE · DRAFT, INSIDE THE DRINK')).toBeTruthy();
    expect(screen.getByText('Saves with the drink. It shows on House-made too.')).toBeTruthy();
    // Method opens How it's made as a sheet: the ways, then the steps.
    await fireEvent.press(screen.getByRole('link', { name: /^Method\. / }));
    await fireEvent.press(screen.getByRole('radio', { name: /^Quick agar clarifying/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Done: Clarified grapefruit goes in Your drink' }));
    expect(screen.queryByTestId('part-page')).toBeNull();
    const line = set.mock.calls.at(-1)[0].lines[0];
    expect(line).toMatchObject({ id: null, name: 'Clarified grapefruit', technique: 'agar-quick', later: undefined });
    expect(line.prep.technique).toBe('agar-quick');
    expect(line.prep.at).toBeUndefined();
    expect(line.prep.lines.length).toBeGreaterThan(1);
  });

  test('a shrub starts from its name: the fruit as the base, a cold method, on its rows', async () => {
    const set = jest.fn();
    await renderWithProviders(<Stateful draft={{ ...EMPTY_DRAFT, name: 'Pineapple Heat' }} set={set} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'Pineapple chili shrub');
    await fireEvent.press(screen.getByRole('button', { name: 'Make “Pineapple chili shrub” in-house' }));
    await partLaidOut();

    expect(screen.getByRole('link', { name: /^What it is\. Shrub/ })).toBeTruthy();
    expect(screen.getByText('Pineapple')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Done: Pineapple chili shrub goes in Pineapple Heat' }));
    const prep = set.mock.calls.at(-1)[0].lines[0].prep;
    expect(prep.kind).toBe('shrub');
    expect(prep.lines.map((l: { name: string }) => l.name)).toEqual(['Pineapple', 'White sugar', 'Apple cider vinegar', 'Fresno chili']);
    expect(prep.leadMinutes).toBe(3 * 24 * 60);
    // Back in the drink, with no notice pointing off to Preps: the line itself is the prep.
    expect(screen.queryByText(/saved to your preps/)).toBeNull();
  });

  test('a prep can be left for later: the name now, its recipe to write, and the line offers it', async () => {
    const set = jest.fn();
    await renderWithProviders(<IngredientsStep draft={EMPTY_DRAFT} set={set} ingredients={[CAMPARI]} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'pineapple chili shrub');
    expect(screen.queryByText('Nothing called that yet. Closest:')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Just add the name “pineapple chili shrub”' }));
    expect(set.mock.calls[0][0].lines[0]).toMatchObject({ id: null, name: 'Pineapple chili shrub', later: true });

    await renderWithProviders(<IngredientsStep draft={{ ...EMPTY_DRAFT, lines: set.mock.calls[0][0].lines }} set={set} ingredients={[CAMPARI]} />);
    // The row stays one ingredient and its pour; what it is and what to do sit behind a tap on the name.
    expect(screen.queryByText('House-made, recipe to write')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /^Pineapple chili shrub, / }));
    expect(screen.getByText('House-made, recipe to write')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Write the recipe for Pineapple chili shrub' })).toBeTruthy();
  });

  test('nothing called that: the closest ingredients, then make it or just add the name', async () => {
    const PINEAPPLE = { id: 'pj', name: 'Pineapple Juice' };
    await renderWithProviders(<IngredientsStep draft={EMPTY_DRAFT} set={jest.fn()} ingredients={[CAMPARI, PINEAPPLE]} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'pineapple chili shrub');
    expect(screen.getByText('Nothing called that yet. Closest:')).toBeTruthy();
    const rows = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel ?? b.props['aria-label']);
    expect(rows.indexOf('Pineapple Juice')).toBeLessThan(rows.indexOf('Make “Pineapple chili shrub” in-house'));
    expect(rows.indexOf('Make “Pineapple chili shrub” in-house')).toBeLessThan(rows.indexOf('Just add the name “pineapple chili shrub”'));
  });

  test('whatever is typed, Make it in house comes under the bottles that match, before the name alone', async () => {
    await renderWithProviders(<IngredientsStep draft={EMPTY_DRAFT} set={jest.fn()} ingredients={[CAMPARI]} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'Yuzu juice');
    expect(screen.getByText('No bottle by that name.')).toBeTruthy();
    let rows = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel ?? b.props['aria-label']);
    expect(rows.indexOf('Make “Yuzu juice” in-house')).toBeLessThan(rows.indexOf('Just add the name “Yuzu juice”'));
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'camp');
    rows = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel ?? b.props['aria-label']);
    expect(rows.indexOf('Campari')).toBeLessThan(rows.indexOf('Make “Camp” in-house'));
  });

  test('a name that exists can still be made your own', async () => {
    await renderWithProviders(<IngredientsStep draft={EMPTY_DRAFT} set={jest.fn()} ingredients={[CAMPARI]} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'Campari');
    expect(screen.queryByRole('button', { name: /^Just add the name/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Make “Campari” in-house' })).toBeTruthy();
    expect(screen.getByText('Return takes the top one. Make is still here: one of your own is saved as yours, next to the one you have.')).toBeTruthy();
  });

  test('a swap opens the same search, Make it in house too, and a bottle picked drops the old one', async () => {
    const set = jest.fn();
    const draft = { ...EMPTY_DRAFT, lines: [{ key: 'a', id: 'lime', name: 'Lime juice', amount: '22.5', unit: 'ml' }] };
    await renderWithProviders(<IngredientsStep draft={draft} set={set} ingredients={[CAMPARI]} />);
    await fireEvent.press(screen.getByRole('button', { name: /^Lime juice, / }));
    // Making in house starts from the search, not the line.
    expect(screen.queryByRole('button', { name: /house/ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Swap Lime juice for another ingredient' }));
    expect(screen.getByLabelText('Rename Lime juice or pick another').props.value).toBe('Lime juice');
    await fireEvent.changeText(screen.getByLabelText('Rename Lime juice or pick another'), 'Campari');
    expect(screen.getByRole('button', { name: 'Make “Campari” in-house' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Campari' }));
    expect(set.mock.calls[0][0].lines[0]).toMatchObject({ id: 'campari', name: 'Campari', prep: undefined, technique: undefined });
  });

  test('a house prep line says what it is, and a tap opens its recipe on the flat page', async () => {
    const prep = { ...startPrep('shrub', 'Pineapple shrub'), way: 'hot' };
    const draft = { ...EMPTY_DRAFT, name: 'Pineapple Heat', lines: [{ key: 'a', id: null, name: 'Pineapple shrub', amount: '15', unit: 'ml', prep }] };
    await renderWithProviders(<Stateful draft={draft} set={jest.fn()} />);
    expect(screen.getByText('House-made')).toBeTruthy();
    expect(screen.getByText('Shrub, hot · Pineapple, white sugar, apple cider vinegar · 5 steps')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Pineapple shrub, 15 ml\. House-made/ }));
    await partLaidOut();
    expect(screen.getByText('HOUSE-MADE · DRAFT, INSIDE THE DRINK')).toBeTruthy();
    expect(screen.getByLabelText('Pineapple. Swap it')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Done: Pineapple shrub goes in Pineapple Heat' })).toBeTruthy();
  });

  const BACARDI = { id: 'bacardi', name: 'Bacardí Carta Blanca', generic_id: 'white-rum' };
  const WHITE_RUM = { id: 'white-rum', name: 'White Rum' };
  const daiquiri = { ...EMPTY_DRAFT, name: 'Coconut Fat-Washed Daiquiri', lines: [{ key: 'a', id: 'bacardi', name: 'Bacardí Carta Blanca', amount: '60', unit: 'ml' }] };

  test('the drink’s name says how the rum is made: one tap makes it house, on the real bottle', async () => {
    const set = jest.fn();
    await renderWithProviders(<Stateful draft={daiquiri} set={set} ingredients={[CAMPARI, BACARDI, WHITE_RUM]} />);
    expect(screen.getByText('The name says coconut fat-washed. Make the Bacardí Carta Blanca that way?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Make it in-house' }));
    await partLaidOut();
    // Its lines: the bottle is the base, the fat is coconut oil.
    expect(screen.getByLabelText('Bacardí Carta Blanca. Swap it')).toBeTruthy();
    expect(screen.getByLabelText('Coconut Oil. Swap it')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Done: Coconut fat-washed Bacardí Carta Blanca goes in/ }));
    const line = set.mock.calls.at(-1)[0].lines[0];
    expect(line).toMatchObject({ id: null, name: 'Coconut fat-washed Bacardí Carta Blanca', technique: 'fat-wash' });
    expect(line.prep.madeFrom).toEqual({ id: 'bacardi', name: 'Bacardí Carta Blanca' });
  });

  test('a line moves up by its grip, and the new order is what saves', async () => {
    const set = jest.fn();
    const lines = [newLine({ id: 'mezcal', name: 'Mezcal' }, 'ml', '45'), newLine({ id: 'lime', name: 'Lime juice' }, 'ml', '22.5'), newLine({ id: 'agave', name: 'Agave syrup' }, 'ml', '15')];
    await renderWithProviders(<IngredientsStep draft={{ ...EMPTY_DRAFT, lines }} set={set} ingredients={[]} />);

    expect(screen.getByText('Hold a line and move it over another. Let go to combine them; move away to just reorder.')).toBeTruthy();
    await fireEvent(screen.getByRole('button', { name: 'Reorder Agave syrup' }), 'accessibilityAction', { nativeEvent: { actionName: 'moveUp' } });
    expect(set.mock.calls[0][0].lines.map((l: { name: string }) => l.name)).toEqual(['Mezcal', 'Agave syrup', 'Lime juice']);
  });

  test('held over another, a line offers to combine them into a house prep', async () => {
    // The line under it lights up; a tag above the lifted card says what letting go does, clear of the thumb, and the card keeps its name.
    await renderWithProviders(<LineRow line={newLine({ id: 'miso', name: 'Red miso' }, 'g', '5')} dropTarget="Tempus Fugit Crème de Banane" onChange={jest.fn()} onRemove={jest.fn()} onSwap={jest.fn()} />);
    expect(screen.getByText('Let go to combine')).toBeTruthy();
    await renderWithProviders(<LineRow line={newLine({ id: 'tf', name: 'Tempus Fugit Crème de Banane' }, 'ml', '22.5')} lifted combineWith="Red miso" onChange={jest.fn()} onRemove={jest.fn()} onSwap={jest.fn()} />);
    expect(screen.getByText('Let go to make it in-house')).toBeTruthy();
    expect(screen.getByText('Tempus Fugit Crème de Banane + Red miso')).toBeTruthy();
    expect(screen.getByText('Tempus Fugit Crème de Banane')).toBeTruthy();
    // Folded while it's held: no stepper or unit.
    expect(screen.queryByRole('button', { name: 'Less Tempus Fugit Crème de Banane' })).toBeNull();
  });

  // Kevin's Salty Boy (24 Oct): red miso dropped on Tempus Fugit, made a sous vide infusion, amounts as they go in.
  const saltyBoy = () => {
    const spec = [newLine({ id: 'tf', name: 'Tempus Fugit Crème de Banane' }, 'ml', '22.5'), newLine({ id: 'miso', name: 'Red miso' }, 'g', '')];
    return { ...EMPTY_DRAFT, name: 'Salty Boy', lines: combineLines(spec, 1, 0, 'Salty Boy')! };
  };

  test('two lines combined open the flat page as a Batch, its lines as measured; Done gives the line its recipe', async () => {
    const set = jest.fn();
    const draft = saltyBoy();
    await renderWithProviders(<Stateful draft={draft} set={set} ingredients={[]} />);
    // The drop opens it; here the line just combined is opened by a tap.
    await fireEvent.press(screen.getByRole('button', { name: /^Salty Boy batch, 22\.5 ml/ }));
    await partLaidOut();
    expect(screen.getByRole('link', { name: /^What it is\. Batch/ })).toBeTruthy();
    expect(screen.getByLabelText('Tempus Fugit Crème de Banane, as measured, ml').props.value).toBe('750');
    await fireEvent.changeText(screen.getByLabelText('Red miso, as measured, g'), '70');
    await fireEvent.press(screen.getByRole('button', { name: 'Done: Salty Boy batch goes in Salty Boy' }));
    const [line] = set.mock.calls.at(-1)[0].lines;
    expect(line).toMatchObject({ key: draft.lines[0].key, name: 'Salty Boy batch', amount: '22.5', unit: 'ml', combined: undefined });
    expect(line.prep.kind).toBe('batch');
    expect(line.prep.lines.map((l: { name: string; amount: string }) => [l.name, l.amount])).toEqual([['Tempus Fugit Crème de Banane', ''], ['Red miso', '70']]);
  });

  test('backing out of two lines just combined puts them back', async () => {
    const set = jest.fn();
    await renderWithProviders(<Stateful draft={saltyBoy()} set={set} ingredients={[]} />);
    await fireEvent.press(screen.getByRole('button', { name: /^Salty Boy batch, / }));
    await partLaidOut();
    await fireEvent.press(screen.getByRole('button', { name: /^Back to Salty Boy/ }));
    expect(set.mock.calls.at(-1)[0].lines.map((l: { name: string }) => l.name)).toEqual(['Tempus Fugit Crème de Banane', 'Red miso']);
  });

  test('a kind typed in full comes first, then its brands, the back bar ones leading', async () => {
    const set = jest.fn();
    const ingredients = [
      { id: 'mezcal', name: 'Mezcal', ingredient_role: 'generic' },
      { id: 'negroni', name: 'Mezcal negroni batch', ingredient_role: 'prep' },
      { id: 'vida', name: 'Del Maguey Vida', generic_id: 'mezcal', ingredient_role: 'product', brand_maker: 'Del Maguey' },
      ...['Banhez Ensamble', 'Ilegal Joven', 'Montelobos Espadín', 'Bozal Cuishe'].map((name, i) => ({ id: `b${i}`, name, generic_id: 'mezcal', ingredient_role: 'product', brand_maker: name.split(' ')[0] })),
    ];
    await renderWithProviders(<IngredientsStep draft={EMPTY_DRAFT} set={set} ingredients={ingredients} backBar={new Set(['vida'])} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'mezcal');

    expect(screen.getByText('Any mezcal · add it as it is')).toBeTruthy();
    expect(screen.getByText('PICK A BRAND · OPTIONAL')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Del Maguey Vida, on your back bar' })).toBeTruthy();
    // Four brands, then the rest behind See all; what only mentions mezcal comes after.
    expect(screen.queryByRole('button', { name: 'Montelobos Espadín' })).toBeNull();
    expect(screen.getByText('More with “mezcal” in the name')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'See all 5 mezcals' }));
    expect(screen.getByRole('button', { name: 'Montelobos Espadín' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Mezcal' }));
    expect(set.mock.calls[0][0].lines[0]).toMatchObject({ id: 'mezcal', name: 'Mezcal' });
  });
});
