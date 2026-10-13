import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { PrepBuilder } from './PrepBuilder';

// The paper band's View as pill reads the signed-in person's prefs; off here.
jest.mock('@/components/ViewAsBanner', () => ({ ViewAsPill: () => null }));
jest.mock('@/hooks/useKit', () => ({ useKit: () => ({ owned: [], kit: new Set(), toggle: jest.fn() }) }));

// The builder draws after its first layout, as the wizard does on iOS.
const laidOut = () => fireEvent(screen.getByTestId('add-prep'), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });
const open = async (name: string, onDone = jest.fn(), onLater?: () => void) => {
  await renderWithTamagui(<PrepBuilder name={name} drinkName="Daiquiri" ingredients={[]} onDone={onDone} onLater={onLater} onClose={jest.fn()} />);
  await laidOut();
  return onDone;
};

describe('PrepBuilder', () => {
  test('a technique name leads with its ways, the likeliest picked; Skip goes on to the recipe', async () => {
    await open('Coconut fat washed white rum');
    expect(screen.getByRole('radio', { name: /^Fat washing/, checked: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.getByText('The recipe')).toBeTruthy();
    expect(screen.getByText('White rum')).toBeTruthy();
    expect(screen.getByText('Coconut Oil')).toBeTruthy();
    expect(screen.getByText('Taken out before bottling')).toBeTruthy();
  });

  test('a stand-in has to be picked or taken out before it can be added', async () => {
    const onDone = await open('Fat-washed rum');
    await fireEvent.press(screen.getByRole('button', { name: 'Next: recipe' }));
    expect(screen.getByRole('button', { name: 'Pick the fat' })).toBeTruthy();
    expect(screen.getByText('Pick the fat, or take it out, to go on.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next: method' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Next: method' }));
    expect(screen.getByText('The recipe')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Remove Melted fat' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next: method' }));
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
    expect(screen.getByText('300 g sugar, 300 g apple cider vinegar, chili')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: /^Oleo shrub/ }));
    expect(screen.getByRole('radio', { name: /^Oleo shrub/, checked: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'All steps' }));
    expect(screen.getByText('1. Muddle the fruit, and any citrus peel, with the sugar.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Next: recipe' }));
    expect(screen.getByText('Daiquiri › New prep · 2 of 3')).toBeTruthy();
    expect(screen.getByText('OLEO SHRUB · EQUAL PARTS BY WEIGHT')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Allergens: none/ }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Sulphites' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add a note to Chili' }));
    await fireEvent.changeText(screen.getByLabelText('Note on Chili'), 'Sliced, seeds in');
    await fireEvent.press(screen.getByRole('button', { name: 'Next: method' }));
    expect(screen.getByText(/^An oleo shrub, filled in from the recipe\./)).toBeTruthy();
    expect(screen.getByText('1 day')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Store: Fridge/ }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Freezer' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add it to Daiquiri' }));
    const prep = onDone.mock.calls[0][0];
    expect(prep.way).toBe('oleo');
    expect(prep.storage).toBe('Freezer');
    expect(prep.allergens).toEqual(['sulphites']);
    expect(prep.allergensSet).toBe(true);
    expect(prep.lines.find((l: { name: string }) => l.name === 'Chili').note).toBe('Sliced, seeds in');
    expect(onLater).not.toHaveBeenCalled();
  });

  test('Later on the first step leaves the recipe for later', async () => {
    const onLater = jest.fn();
    await open('Lime cordial', jest.fn(), onLater);
    await fireEvent.press(screen.getByRole('button', { name: 'Later' }));
    expect(onLater).toHaveBeenCalled();
  });
});
