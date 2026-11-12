import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';
import { startPrep } from '@/lib/prepKinds';

import { PrepBuilder } from './PrepBuilder';

// Made in parts (board Add-parts): a part opens as one flat page, three levels at most.
jest.mock('@/components/ViewAsBanner', () => ({ ViewAsPill: () => null }));
jest.mock('@/hooks/useNearIngredients', () => ({ useNearIngredients: () => [], useNearIngredientsChecked: () => ({ near: [], checking: false }) }));
jest.mock('@/hooks/useKit', () => ({ useKit: () => ({ owned: [], kit: new Set(), toggle: jest.fn() }) }));
jest.mock('@/hooks/useBarKit', () => ({ useMakingKit: () => ({ kit: new Set(), where: 'My Bar', add: jest.fn() }) }));
jest.mock('@/hooks/usePrepCard', () => ({ ...jest.requireActual('@/hooks/usePrepCard'), useCatalogRecipe: () => ({ data: null }) }));
const mockSame = jest.fn((): unknown => null);
jest.mock('@/hooks/useSameNamePrep', () => ({ ...jest.requireActual('@/hooks/useSameNamePrep'), useSameNamePrep: () => ({ data: mockSame(), checking: false }) }));

const laidOut = () => fireEvent(screen.getByTestId('add-prep'), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });
// The part's page lays out before it draws on iOS (KeyboardScreen): the innermost level showing.
const partLaidOut = () => fireEvent(screen.getAllByTestId('part-page').at(-1)!, 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });
const batch = () => ({ ...startPrep('batch', 'Penicillin batch'), lines: [{ key: 'a', id: 'scotch', name: 'Blended scotch', parts: null, unit: 'ml', amount: '500' }], baseKey: 'a' });

describe('Made in parts', () => {
  test('Make X here leads the search, opens one flat page, and its own part goes one more level in, three at most', async () => {
    const onKeep = jest.fn();
    await renderWithProviders(<PrepBuilder name="Penicillin batch" initial={batch()} startAt="recipe" ingredients={[]} bar={{ id: 'b1', name: 'Caretaker’s' }} onKeep={onKeep} onDone={jest.fn()} onClose={jest.fn()} />);
    await laidOut();
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'Honey-ginger syrup');
    const rows = screen.getAllByRole('button').map((b) => String(b.props.accessibilityLabel ?? '')).filter((l) => /Honey-ginger syrup/.test(l));
    expect(rows[0]).toMatch(/^Make “Honey-ginger syrup” here/);
    expect(rows[1]).toMatch(/a bottle you buy/);
    await fireEvent.press(screen.getByRole('button', { name: /^Make “Honey-ginger syrup” here/ }));
    await partLaidOut();
    // One level in: a part of the batch, then What it is, Method, Makes, Keeps.
    expect(screen.getByText('HOUSE-MADE · A PART OF PENICILLIN BATCH')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^What it is/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Keeps/ })).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'Fresh ginger juice');
    await fireEvent.press(screen.getByRole('button', { name: /^Make “Fresh ginger juice” here/ }));
    await partLaidOut();
    expect(screen.getByText('HOUSE-MADE · A PART OF HONEY-GINGER SYRUP')).toBeTruthy();
    // The third level: no Make here, and the card says why.
    expect(screen.getByText('Three levels is the most.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'Ginger shrub');
    expect(screen.queryByRole('button', { name: /^Make “Ginger shrub”/ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /^Add “Ginger shrub”, a bottle/ }));
    // The third level can't make a part, so a name alone there isn't tagged To make.
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'Pine syrup');
    await fireEvent.press(screen.getByRole('button', { name: /^Add “Pine syrup”$/ }));
    expect(screen.queryByText('To make')).toBeNull();
    // Done goes back a level at a time, and the draft keeps the parts on their lines.
    await fireEvent.press(screen.getByRole('button', { name: /^Done: Fresh ginger juice goes in/ }));
    await partLaidOut();
    expect(screen.getByText('HOUSE-MADE · A PART OF PENICILLIN BATCH')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Done: Honey-ginger syrup goes in/ }));
    await laidOut();
    expect(screen.getByText('Saves 3 house-mades together: Penicillin batch, Honey-ginger syrup and Fresh ginger juice. If one can’t save, none do.')).toBeTruthy();
    const kept = onKeep.mock.calls.at(-1)![0];
    const syrup = kept.lines.find((l: { name: string }) => l.name === 'Honey-ginger syrup');
    const juice = syrup.prep.lines.find((l: { name: string }) => l.name === 'Fresh ginger juice');
    expect(juice.prep.lines.map((l: { name: string; bottle?: boolean }) => [l.name, !!l.bottle])).toContainEqual(['Ginger shrub', true]);
  });

  test('a part has an Allergens row (Kevin, 12 Nov, 3a): found from its lines, ticked in place, and carried up to the house-made', async () => {
    const onKeep = jest.fn();
    await renderWithProviders(<PrepBuilder name="Penicillin batch" initial={batch()} startAt="recipe" ingredients={[]} bar={{ id: 'b1', name: 'Caretaker’s' }} onKeep={onKeep} onDone={jest.fn()} onClose={jest.fn()} />);
    await laidOut();
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'House sour');
    await fireEvent.press(screen.getByRole('button', { name: /^Make “House sour” here/ }));
    await partLaidOut();
    // The fifth row of the part's group, None found while nothing is.
    expect(screen.getByRole('button', { name: /^Allergens/ })).toBeTruthy();
    expect(screen.getByText('None found')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'Egg white');
    await fireEvent.press(screen.getByRole('button', { name: /^Add “Egg white”$/ }));
    expect(screen.getByText('Eggs')).toBeTruthy();
    // It opens in place: tick one by hand.
    await fireEvent.press(screen.getByRole('button', { name: /^Allergens/ }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Sulphites' }));
    expect(screen.getByText('Eggs and sulphites')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Done: House sour goes in/ }));
    await laidOut();
    // Up in the house-made, both are in it, and the one from the part can't be ticked off there.
    expect(screen.getByText('Eggs and sulphites')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Allergens/ }));
    expect(screen.getByRole('checkbox', { name: 'Sulphites, from a part' })).toBeDisabled();
    const part = onKeep.mock.calls.at(-1)![0].lines.find((l: { name: string }) => l.name === 'House sour').prep;
    expect([part.allergens, part.allergensSet]).toEqual([['eggs', 'sulphites'], true]);
  });

  test('a part whose name says nothing about how it’s made starts empty; Add “X” leaves a line To make, and its card makes it one more level in', async () => {
    const onKeep = jest.fn();
    await renderWithProviders(<PrepBuilder name="Penicillin batch" initial={batch()} startAt="recipe" ingredients={[]} bar={{ id: 'b1', name: 'Caretaker’s' }} onKeep={onKeep} onDone={jest.fn()} onClose={jest.fn()} />);
    await laidOut();
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'Rvwa batch');
    await fireEvent.press(screen.getByRole('button', { name: /^Make “Rvwa batch” here/ }));
    await partLaidOut();
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'Fresh ginger juice');
    await fireEvent.press(screen.getByRole('button', { name: /^Make “Fresh ginger juice” here/ }));
    await partLaidOut();
    // Frame 3: no lines guessed from the words of its name ("Fresh", "Ginger", "Juice"), and nothing kept on its line yet.
    expect(screen.getByText('HOUSE-MADE · A PART OF RVWA BATCH')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /\. Swap it$/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^Done: Fresh ginger juice goes in/ })).toBeDisabled();
    // Back from an untouched part leaves Rvwa batch as it was.
    await fireEvent.press(screen.getByRole('button', { name: /^Back/ }));
    await partLaidOut();
    expect(screen.getByText('HOUSE-MADE · A PART OF PENICILLIN BATCH')).toBeTruthy();
    expect(screen.queryByText(/Fresh ginger juice/)).toBeNull();
    // The name alone: a line To make, and the card offers to make it here.
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'fresh ginger juice');
    await fireEvent.press(screen.getByRole('button', { name: /^Add “Fresh ginger juice”$/ }));
    expect(screen.getByText('To make')).toBeTruthy();
    expect(screen.getByText('Fresh ginger juice isn’t one of yours yet.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Make Fresh ginger juice here/ }));
    await partLaidOut();
    expect(screen.getByText('HOUSE-MADE · A PART OF RVWA BATCH')).toBeTruthy();
    expect(screen.getByText('Three levels is the most.')).toBeTruthy();
  });

  test('a part named like one you have: Use yours first, and the line uses it', async () => {
    mockSame.mockReturnValue({ id: 'gj', name: 'Fresh ginger juice', here: true, drinks: 2, made: '2026-10-03T12:00:00Z' });
    const onKeep = jest.fn();
    await renderWithProviders(<PrepBuilder name="Penicillin batch" initial={batch()} startAt="recipe" ingredients={[]} bar={{ id: 'b1', name: 'Caretaker’s' }} onKeep={onKeep} onDone={jest.fn()} onClose={jest.fn()} />);
    await laidOut();
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'Fresh ginger juice');
    await fireEvent.press(screen.getByRole('button', { name: /^Make “Fresh ginger juice” here/ }));
    await partLaidOut();
    expect(screen.getByText('You have a Fresh ginger juice')).toBeTruthy();
    expect(screen.getByText('Caretaker’s made it in October, in 2 drinks. Use that one here, or make a new one.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Make a new one/ })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Use yours/ }));
    await laidOut();
    expect(screen.getByText('PENICILLIN BATCH · 2 OF 3')).toBeTruthy();
    const line = onKeep.mock.calls.at(-1)![0].lines.find((l: { name: string }) => l.name === 'Fresh ginger juice');
    expect(line).toEqual(expect.objectContaining({ id: 'gj' }));
    expect(line.prep).toBeUndefined();
    mockSame.mockReturnValue(null);
  });

  test('on the web’s dialog the part opens under its line, and Close the part puts it back', async () => {
    await renderWithProviders(<PrepBuilder embedded name="Penicillin batch" initial={batch()} startAt="recipe" ingredients={[]} bar={{ id: 'b1', name: 'Caretaker’s' }} onKeep={jest.fn()} onDone={jest.fn()} onClose={jest.fn()} />);
    await laidOut();
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'Honey-ginger syrup');
    await fireEvent.press(screen.getByRole('button', { name: /^Make “Honey-ginger syrup” here/ }));
    expect(screen.getByText('Honey-ginger syrup · a part, opened under its line')).toBeTruthy();
    expect(screen.getByText('PENICILLIN BATCH · 2 OF 3')).toBeTruthy();
    // A part inside it opens under its own line too (the part's search comes before the batch's), and only the innermost part has a Close.
    await fireEvent.changeText(screen.getAllByLabelText('Add an ingredient')[0], 'Fresh ginger juice');
    await fireEvent.press(screen.getByRole('button', { name: /^Make “Fresh ginger juice” here/ }));
    expect(screen.getByText('Fresh ginger juice · a part, opened under its line')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Close the part' })).toHaveLength(1);
    // Empty, it closes as Back does: the line goes, and the outer part has its Close again.
    await fireEvent.press(screen.getByRole('button', { name: 'Close the part' }));
    expect(screen.queryByText('Fresh ginger juice · a part, opened under its line')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Close the part' })).toHaveLength(1);
  });
});
