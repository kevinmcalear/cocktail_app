import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { combineLines } from '@/lib/batchLines';
import { EMPTY_DRAFT, newLine } from '@/lib/drinkWizard';
import { startPrep } from '@/lib/prepKinds';

import { IngredientsStep } from './IngredientsStep';
import { LineRow } from './LineRow';

// Pairings come from the database; these tests are about the field.
// The paper band's View as pill reads the signed-in person's prefs; off here.
jest.mock('@/components/ViewAsBanner', () => ({ ViewAsPill: () => null }));
jest.mock('@/hooks/useNearIngredients', () => ({ useNearIngredients: () => [] }));
jest.mock('@/hooks/usePairings', () => ({ usePairings: () => ({ data: [] }) }));
jest.mock('@/hooks/useClosestClassic', () => ({ useClosestClassic: () => ({ data: null }) }));
jest.mock('@/hooks/useIngredientUse', () => ({ useIngredientUse: (id: string | null) => ({ data: id === 'campari' ? 14 : 0 }) }));
jest.mock('@/hooks/useDiscover', () => ({ useDrinkLists: () => ({ data: [] }) }));
jest.mock('@/hooks/useStartFromClassic', () => ({ useStartFromClassic: () => ({ mutate: jest.fn(), isPending: false }) }));
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ venues: [] }) }));
jest.mock('@/hooks/useKit', () => ({ useKit: () => ({ owned: [], kit: new Set(), toggle: jest.fn() }) }));
jest.mock('@/hooks/useBarKit', () => ({ useMakingKit: () => ({ kit: new Set(), where: 'My Bar', add: jest.fn() }) }));
jest.mock('@/hooks/usePrepCard', () => ({ ...jest.requireActual('@/hooks/usePrepCard'), useCatalogRecipe: () => ({ data: null }) }));

// The prep builder draws after its first layout, as the wizard does on iOS.
const laidOut = () => fireEvent(screen.getByTestId('add-prep'), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });

const CAMPARI = { id: 'campari', name: 'Campari', item_images: [{ images: { url: 'https://example.test/campari.jpg' } }] };

describe('IngredientsStep', () => {
  test('while the list loads, a typed name is never added as a new ingredient', async () => {
    const set = jest.fn();
    await renderWithTamagui(<IngredientsStep draft={EMPTY_DRAFT} set={set} ingredients={[]} loading />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'Campari');

    expect(screen.getByText('Loading ingredients…')).toBeTruthy();
    expect(screen.queryByText('Just add the name')).toBeNull();
    await fireEvent(screen.getByLabelText('Add an ingredient'), 'submitEditing');
    expect(set).not.toHaveBeenCalled();
  });

  test('once loaded, it finds the bottle and still offers a new one', async () => {
    const set = jest.fn();
    await renderWithTamagui(<IngredientsStep draft={EMPTY_DRAFT} set={set} ingredients={[CAMPARI]} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'camp');

    expect(screen.getByRole('button', { name: 'Just add the name “camp”' })).toBeTruthy();
    // How much it's used, under its name.
    expect(screen.getByText('In 14 drinks')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Campari' }));
    expect(set.mock.calls[0][0].lines[0]).toMatchObject({ id: 'campari', name: 'Campari' });
  });

  test('a pour typed before the name is the line\'s: "30ml camp" finds Campari at 30 ml, "1/2 pommeau" adds a new one', async () => {
    const set = jest.fn();
    await renderWithTamagui(<IngredientsStep draft={EMPTY_DRAFT} set={set} ingredients={[CAMPARI]} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), '30ml camp');
    expect(screen.getByText('30 ml of the one you pick')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Campari' }));
    expect(set.mock.calls[0][0].lines[0]).toMatchObject({ id: 'campari', name: 'Campari', amount: '30', unit: 'ml' });

    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), '1/2 pommeau');
    await fireEvent(screen.getByLabelText('Add an ingredient'), 'submitEditing');
    expect(set.mock.calls[1][0].lines[0]).toMatchObject({ id: null, name: 'pommeau', amount: '0.5' });
  });

  test('a prep the shelf lacks is made in house from a technique: the line carries its recipe', async () => {
    const set = jest.fn();
    await renderWithTamagui(<IngredientsStep draft={EMPTY_DRAFT} set={set} ingredients={[CAMPARI]} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'Clarified grapefruit');

    await fireEvent.press(screen.getByRole('button', { name: 'Make “Clarified grapefruit” in-house' }));
    await laidOut();
    await fireEvent.press(screen.getByRole('radio', { name: /^Quick agar clarifying/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next: what goes in' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next: how it’s made' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add it to the drink' }));
    const line = set.mock.calls[0][0].lines[0];
    expect(line).toMatchObject({ id: null, name: 'Clarified grapefruit', technique: 'agar-quick' });
    expect(line.prep.technique).toBe('agar-quick');
    expect(line.prep.lines.length).toBeGreaterThan(1);
  });

  test('a shrub starts from its name: the fruit as the base, equal parts, a cold method', async () => {
    const set = jest.fn();
    await renderWithTamagui(<IngredientsStep draft={{ ...EMPTY_DRAFT, name: 'Pineapple Heat' }} set={set} ingredients={[CAMPARI]} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'Pineapple chili shrub');
    await fireEvent.press(screen.getByRole('button', { name: 'Make “Pineapple chili shrub” in-house' }));
    await laidOut();

    expect(screen.getByRole('radio', { name: 'Shrub, Fruit, sugar, vinegar, from the name', checked: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Next: what goes in' }));
    expect(screen.getByText('Pineapple')).toBeTruthy();
    expect(screen.getByText('The base, everything follows it')).toBeTruthy();
    expect(screen.getByText('SHRUB, COLD · EQUAL PARTS BY WEIGHT')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Next: how it’s made' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add it to Pineapple Heat' }));
    const prep = set.mock.calls[0][0].lines[0].prep;
    expect(prep.kind).toBe('shrub');
    expect(prep.lines.map((l: { name: string }) => l.name)).toEqual(['Pineapple', 'White sugar', 'Apple cider vinegar', 'Fresno chili']);
    expect(prep.leadMinutes).toBe(3 * 24 * 60);
    // Back in the drink, with no notice pointing off to Preps: the line itself is the prep.
    expect(screen.queryByText(/saved to your preps/)).toBeNull();
  });

  test('a prep can be left for later: the name now, its recipe to write, and the line offers it', async () => {
    const set = jest.fn();
    await renderWithTamagui(<IngredientsStep draft={EMPTY_DRAFT} set={set} ingredients={[CAMPARI]} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'pineapple chili shrub');
    expect(screen.queryByText('Nothing called that yet. Closest:')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Just add the name “pineapple chili shrub”' }));
    expect(set.mock.calls[0][0].lines[0]).toMatchObject({ id: null, name: 'Pineapple chili shrub', later: true });

    await renderWithTamagui(<IngredientsStep draft={{ ...EMPTY_DRAFT, lines: set.mock.calls[0][0].lines }} set={set} ingredients={[CAMPARI]} />);
    // The row stays one ingredient and its pour; what it is and what to do sit behind a tap on the name.
    expect(screen.queryByText('House-made, recipe to write')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /^Pineapple chili shrub, / }));
    expect(screen.getByText('House-made, recipe to write')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Write the recipe for Pineapple chili shrub' })).toBeTruthy();
  });

  test('nothing called that: the closest ingredients, then make it or just add the name', async () => {
    const PINEAPPLE = { id: 'pj', name: 'Pineapple Juice' };
    await renderWithTamagui(<IngredientsStep draft={EMPTY_DRAFT} set={jest.fn()} ingredients={[CAMPARI, PINEAPPLE]} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'pineapple chili shrub');
    expect(screen.getByText('Nothing called that yet. Closest:')).toBeTruthy();
    const rows = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel ?? b.props['aria-label']);
    expect(rows.indexOf('Pineapple Juice')).toBeLessThan(rows.indexOf('Make “Pineapple chili shrub” in-house'));
    expect(rows.indexOf('Make “Pineapple chili shrub” in-house')).toBeLessThan(rows.indexOf('Just add the name “pineapple chili shrub”'));
  });

  test('whatever is typed, Make it in house comes under the bottles that match, before the name alone', async () => {
    await renderWithTamagui(<IngredientsStep draft={EMPTY_DRAFT} set={jest.fn()} ingredients={[CAMPARI]} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'Yuzu juice');
    expect(screen.getByText('No bottle by that name.')).toBeTruthy();
    let rows = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel ?? b.props['aria-label']);
    expect(rows.indexOf('Make “Yuzu juice” in-house')).toBeLessThan(rows.indexOf('Just add the name “Yuzu juice”'));
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'camp');
    rows = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel ?? b.props['aria-label']);
    expect(rows.indexOf('Campari')).toBeLessThan(rows.indexOf('Make “Camp” in-house'));
  });

  test('a name that exists can still be made your own', async () => {
    await renderWithTamagui(<IngredientsStep draft={EMPTY_DRAFT} set={jest.fn()} ingredients={[CAMPARI]} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'Campari');
    expect(screen.queryByRole('button', { name: /^Just add the name/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Make “Campari” in-house' })).toBeTruthy();
    expect(screen.getByText('Return takes the top one. Make is still here: one of your own is saved as yours, next to the one you have.')).toBeTruthy();
  });

  test('a swap opens the same search, Make it in house too, and a bottle picked drops the old one', async () => {
    const set = jest.fn();
    const draft = { ...EMPTY_DRAFT, lines: [{ key: 'a', id: 'lime', name: 'Lime juice', amount: '22.5', unit: 'ml' }] };
    await renderWithTamagui(<IngredientsStep draft={draft} set={set} ingredients={[CAMPARI]} />);
    await fireEvent.press(screen.getByRole('button', { name: /^Lime juice, / }));
    // Making in house starts from the search, not the line.
    expect(screen.queryByRole('button', { name: /house/ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Swap Lime juice for another ingredient' }));
    await fireEvent.changeText(screen.getByLabelText('Swap Lime juice for…'), 'Campari');
    expect(screen.getByRole('button', { name: 'Make “Campari” in-house' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Campari' }));
    expect(set.mock.calls[0][0].lines[0]).toMatchObject({ id: 'campari', name: 'Campari', prep: undefined, technique: undefined });
  });

  test('a house prep line says what it is, and a tap opens its recipe', async () => {
    const prep = { ...startPrep('shrub', 'Pineapple shrub'), way: 'hot' };
    const draft = { ...EMPTY_DRAFT, name: 'Pineapple Heat', lines: [{ key: 'a', id: null, name: 'Pineapple shrub', amount: '15', unit: 'ml', prep }] };
    await renderWithTamagui(<IngredientsStep draft={draft} set={jest.fn()} ingredients={[CAMPARI]} />);
    expect(screen.getByText('House-made')).toBeTruthy();
    expect(screen.getByText('Shrub, hot · Pineapple, white sugar, apple cider vinegar · 5 steps')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Pineapple shrub, 15 ml\. House-made/ }));
    await laidOut();
    expect(screen.getByText('What goes in?')).toBeTruthy();
    expect(screen.getByText('In Pineapple Heat')).toBeTruthy();
  });

  const BACARDI = { id: 'bacardi', name: 'Bacardí Carta Blanca', generic_id: 'white-rum' };
  const WHITE_RUM = { id: 'white-rum', name: 'White Rum' };
  const daiquiri = { ...EMPTY_DRAFT, name: 'Coconut Fat-Washed Daiquiri', lines: [{ key: 'a', id: 'bacardi', name: 'Bacardí Carta Blanca', amount: '60', unit: 'ml' }] };

  test('the drink’s name says how the rum is made: one tap makes it house, on the real bottle', async () => {
    const set = jest.fn();
    await renderWithTamagui(<IngredientsStep draft={daiquiri} set={set} ingredients={[CAMPARI, BACARDI, WHITE_RUM]} />);
    expect(screen.getByText('The name says coconut fat-washed. Make the Bacardí Carta Blanca that way?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Make it in-house' }));
    await laidOut();
    // Straight to the recipe: the bottle is the base, the fat is coconut oil.
    expect(screen.getByLabelText('Bacardí Carta Blanca. Swap it')).toBeTruthy();
    expect(screen.getByLabelText('Coconut Oil. Swap it')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Next: how it’s made' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add it to Coconut Fat-Washed Daiquiri' }));
    const line = set.mock.calls.at(-1)[0].lines[0];
    expect(line).toMatchObject({ id: null, name: 'Coconut fat-washed Bacardí Carta Blanca', technique: 'fat-wash' });
    expect(line.prep.madeFrom).toEqual({ id: 'bacardi', name: 'Bacardí Carta Blanca' });
  });

  test('a line moves up by its grip, and the new order is what saves', async () => {
    const set = jest.fn();
    const lines = [newLine({ id: 'mezcal', name: 'Mezcal' }, 'ml', '45'), newLine({ id: 'lime', name: 'Lime juice' }, 'ml', '22.5'), newLine({ id: 'agave', name: 'Agave syrup' }, 'ml', '15')];
    await renderWithTamagui(<IngredientsStep draft={{ ...EMPTY_DRAFT, lines }} set={set} ingredients={[]} />);

    expect(screen.getByText('Hold a line by its grip and move it over another. Let go to combine them; move away to just reorder.')).toBeTruthy();
    await fireEvent(screen.getByRole('button', { name: 'Reorder Agave syrup' }), 'accessibilityAction', { nativeEvent: { actionName: 'up' } });
    expect(set.mock.calls[0][0].lines.map((l: { name: string }) => l.name)).toEqual(['Mezcal', 'Agave syrup', 'Lime juice']);
  });

  test('held over another, a line offers to combine them into a house prep', async () => {
    await renderWithTamagui(<LineRow line={newLine({ id: 'tf', name: 'Tempus Fugit Crème de Banane' }, 'ml', '22.5')} dropTarget="Red miso" onChange={jest.fn()} onRemove={jest.fn()} onSwap={jest.fn()} />);
    expect(screen.getByText('Combine and make it in-house')).toBeTruthy();
    expect(screen.getByText('Red miso + Tempus Fugit Crème de Banane')).toBeTruthy();
    expect(screen.getByText('Let go to combine')).toBeTruthy();
  });

  // Kevin's Salty Boy (24 Oct): red miso dropped on Tempus Fugit, made a sous vide infusion, amounts as they go in.
  const saltyBoy = () => {
    const spec = [newLine({ id: 'tf', name: 'Tempus Fugit Crème de Banane' }, 'ml', '22.5'), newLine({ id: 'miso', name: 'Red miso' }, 'g', '')];
    return { ...EMPTY_DRAFT, name: 'Salty Boy', lines: combineLines(spec, 1, 0, 'Salty Boy')! };
  };

  test('two lines combined open the house prep steps on What is it, as a Batch; Done gives the line its recipe', async () => {
    const set = jest.fn();
    const draft = saltyBoy();
    await renderWithTamagui(<IngredientsStep draft={draft} set={set} ingredients={[]} />);
    // The drop opens it; here the line just combined is opened by a tap.
    await fireEvent.press(screen.getByRole('button', { name: /^Salty Boy batch, 22\.5 ml/ }));
    await laidOut();
    expect(screen.getByText('What are you making?')).toBeTruthy();
    expect(screen.getByText('FROM TEMPUS FUGIT CRÈME DE BANANE AND RED MISO')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /^Batch, .*from the name/, checked: true })).toBeTruthy();
    expect(screen.getByText('Dropping two lines together starts as Batch. Naming it changes the suggestion; you pick.')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Name'), 'Miso banana liqueur');
    expect(screen.getByRole('radio', { name: 'Infusion, A spirit plus a flavour, from the name' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: /^Infusion/ }));
    await fireEvent.press(screen.getByRole('radio', { name: /^Sous vide infusion\. 1 to 3 hours\. Needs a sous vide circulator/ }));
    expect(screen.getByText('Sous vide fills in the method: seal, water bath, strain.')).toBeTruthy();

    // What goes in, as measured: the liqueur fills the bottle, the miso is typed in grams.
    await fireEvent.press(screen.getByRole('button', { name: 'Next: what goes in' }));
    expect(screen.getByRole('radio', { name: 'As measured', checked: true })).toBeTruthy();
    expect(screen.getByLabelText('Tempus Fugit Crème de Banane, as measured, ml').props.value).toBe('750');
    await fireEvent.changeText(screen.getByLabelText('Red miso, as measured, g'), '70');
    expect(screen.getByText('In Salty Boy')).toBeTruthy();
    expect(screen.getByText('One bottle makes about 33 Salty Boys, so each gets 2.1 g of red miso.')).toBeTruthy();

    // How it's made: the sous vide steps, and starters to add more.
    await fireEvent.press(screen.getByRole('button', { name: 'Next: how it’s made' }));
    expect(screen.getByText(/^Seal the spirit and solids/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Add a step: Bottle' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add it to Salty Boy' }));
    const [line] = set.mock.calls.at(-1)[0].lines;
    expect(line).toMatchObject({ key: draft.lines[0].key, name: 'Miso banana liqueur', amount: '22.5', unit: 'ml', combined: undefined, technique: 'sous-vide-infusion' });
    expect(line.prep).toMatchObject({ kind: 'infusion', way: 'sous-vide' });
    expect(line.prep.lines.map((l: { name: string; amount: string }) => [l.name, l.amount])).toEqual([['Tempus Fugit Crème de Banane', ''], ['Red miso', '70']]);
    expect(line.prep.steps.at(-1).body).toBe('Bottle it and write the date on it.');
  });

  test('backing out of two lines just combined puts them back', async () => {
    const set = jest.fn();
    await renderWithTamagui(<IngredientsStep draft={saltyBoy()} set={set} ingredients={[]} />);
    await fireEvent.press(screen.getByRole('button', { name: /^Salty Boy batch, / }));
    await laidOut();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Salty Boy' }));
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
    await renderWithTamagui(<IngredientsStep draft={EMPTY_DRAFT} set={set} ingredients={ingredients} backBar={new Set(['vida'])} />);
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
