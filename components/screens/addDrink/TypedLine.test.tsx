import { act, fireEvent, screen } from '@testing-library/react-native';
import { useEffect, useState } from 'react';

import { renderWithTamagui } from '@/jest.setup';
import { EMPTY_DRAFT, type WizardDraft } from '@/lib/drinkWizard';

import { IngredientsStep } from './IngredientsStep';

// Pairings and counts come from the database; these tests are about reading what's typed.
jest.mock('@/components/ViewAsBanner', () => ({ ViewAsPill: () => null }));
jest.mock('@/hooks/usePairings', () => ({ usePairings: () => ({ data: [] }) }));
jest.mock('@/hooks/useClosestClassic', () => ({ useClosestClassic: () => ({ data: null }) }));
jest.mock('@/hooks/useIngredientUse', () => ({ useIngredientUse: () => ({ data: 0 }) }));
jest.mock('@/hooks/useDiscover', () => ({ useDrinkLists: () => ({ data: [] }) }));
jest.mock('@/hooks/useStartFromClassic', () => ({ useStartFromClassic: () => ({ mutate: jest.fn(), isPending: false }) }));
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ venues: [] }) }));
jest.mock('@/hooks/useKit', () => ({ useKit: () => ({ owned: [], kit: new Set(), toggle: jest.fn() }) }));
jest.mock('@/hooks/usePrepCard', () => ({ ...jest.requireActual('@/hooks/usePrepCard'), useCatalogRecipe: () => ({ data: null }) }));

const laidOut = () => fireEvent(screen.getByTestId('add-prep'), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });

const INGREDIENTS = [
  { id: 'bacardi', name: 'Bacardí Carta Blanca', generic_id: 'white-rum' },
  { id: 'white-rum', name: 'White Rum' },
  { id: 'lime', name: 'Lime juice' },
  { id: 'simple', name: 'Simple syrup' },
  { id: 'mint-oil', name: 'Mint oil' },
];

/** The step with a real draft, so what it adds is there on the next render. */
const drafts: WizardDraft[] = [];
const latest = () => drafts[drafts.length - 1];
function Step() {
  const [draft, setDraft] = useState<WizardDraft>({ ...EMPTY_DRAFT, name: 'Daiquiri' });
  useEffect(() => {
    drafts.push(draft);
  }, [draft]);
  return <IngredientsStep draft={draft} set={(c) => setDraft((d) => ({ ...d, ...c }))} ingredients={INGREDIENTS} />;
}

const type = (text: string) => fireEvent.changeText(screen.getByLabelText('Add an ingredient'), text);

describe('typing a line the way you’d write it', () => {
  test('says what it read, then Looks right makes the bottle house at the typed pour', async () => {
    await renderWithTamagui(<Step />);
    await type('60 ml coconut fat-washed bacardi');
    expect(screen.getByText('HERE’S WHAT I READ')).toBeTruthy();
    expect(screen.getByText('60 ml')).toBeTruthy();
    expect(screen.getByText('Fat washing')).toBeTruthy();
    expect(screen.getByText('Coconut')).toBeTruthy();
    expect(screen.getByText('Adds Coconut fat-washed Bacardí Carta Blanca, made in-house with the fat washing recipe filled in.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Looks right: add Coconut fat-washed Bacardí Carta Blanca' }));
    await laidOut();
    expect(screen.getByLabelText('Bacardí Carta Blanca. Swap it')).toBeTruthy();
    expect(screen.getByLabelText('Coconut Oil. Swap it')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Next: how it’s made' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add it to Daiquiri' }));
    const [line] = latest().lines;
    expect(line).toMatchObject({ name: 'Coconut fat-washed Bacardí Carta Blanca', amount: '60', unit: 'ml', technique: 'fat-wash' });
    expect(line.prep?.madeFrom).toEqual({ id: 'bacardi', name: 'Bacardí Carta Blanca' });
  });

  test('Check it adds the bottle and opens the house prep steps on What is it, the way you typed picked', async () => {
    await renderWithTamagui(<Step />);
    await type('coconut fat-washed bacardi');
    await fireEvent.press(screen.getByRole('button', { name: 'Check how Bacardí Carta Blanca was made' }));
    await laidOut();
    expect(latest().lines.map((l) => l.id)).toEqual(['bacardi']);
    expect(screen.getByText('What are you making?')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /^Wash, /, checked: true })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /^Fat\. /, checked: true })).toBeTruthy();
    // Under the lines, it waits to be answered.
    expect(screen.getByText('You wrote coconut fat-washed. Make the Bacardí Carta Blanca that way?')).toBeTruthy();
  });

  test('Return does what the card says, not the top search hit', async () => {
    await renderWithTamagui(<Step />);
    await type('60 ml coconut fat-washed bacardi');
    await fireEvent(screen.getByLabelText('Add an ingredient'), 'submitEditing');
    await laidOut();
    expect(screen.getByLabelText('Coconut Oil. Swap it')).toBeTruthy();
    expect(latest().lines.map((l) => [l.id, l.amount, l.unit])).toEqual([['bacardi', '60', 'ml']]);
  });

  test('a plain bottle is just searched, with no reading', async () => {
    await renderWithTamagui(<Step />);
    await type('30 ml bacardi');
    expect(screen.queryByText('HERE’S WHAT I READ')).toBeNull();
    expect(screen.getByRole('button', { name: 'Bacardí Carta Blanca' })).toBeTruthy();
  });
});

describe('pasting a whole spec', () => {
  test('every line is read first, then added in order: the finish to the finish, the wash asks once', async () => {
    await renderWithTamagui(<Step />);
    await fireEvent.press(screen.getByRole('button', { name: 'Paste a whole spec' }));
    await fireEvent.changeText(screen.getByLabelText('The spec'), 'Daiquiri\n2 oz coconut fat-washed Bacardi\n1 oz lime juice\n.5 oz simple syrup\n3 drops mint oil on top\nShake, fine strain');
    expect(screen.getByText('The drink’s name')).toBeTruthy();
    expect(screen.getByText('Make it in-house: fat washing')).toBeTruthy();
    expect(screen.getByText('Finish')).toBeTruthy();
    expect(screen.getByText('Set in its own step')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Add 4 lines' }));
    expect(latest().lines.map((l) => [l.id, l.amount, l.unit])).toEqual([
      ['bacardi', '2', 'oz'],
      ['lime', '1', 'oz'],
      ['simple', '0.5', 'oz'],
    ]);
    expect(latest().garnishes.map((l) => [l.id, l.amount, l.unit])).toEqual([['mint-oil', '3', 'drop']]);
    expect(screen.getByText('Mint oil went to the finish.')).toBeTruthy();
    expect(screen.getByText('You wrote coconut fat-washed. Make the Bacardí Carta Blanca that way?')).toBeTruthy();
    // The box closes once the lines are in.
    expect(screen.queryByLabelText('The spec')).toBeNull();

    // Not now puts it off; the drink's own name says nothing, so nothing else asks.
    await act(() => fireEvent.press(screen.getByRole('button', { name: 'Not now' })));
    expect(screen.queryByText(/You wrote/)).toBeNull();
  });
});
