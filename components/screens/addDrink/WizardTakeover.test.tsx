import { useState } from 'react';
import { BackHandler, Text } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { EMPTY_DRAFT, type WizardDraft } from '@/lib/drinkWizard';

import { IngredientsStep } from './IngredientsStep';
import { WizardFrame } from './WizardFrame';

// A phone: the takeover is only there (Q16).
jest.mock('@/components/ds', () => ({ ...jest.requireActual('@/components/ds'), useBreakpoint: () => 'phone' }));
jest.mock('@/components/ViewAsBanner', () => ({ ViewAsPill: () => null }));
jest.mock('@/hooks/useNearIngredients', () => ({ useNearIngredients: () => [] }));
jest.mock('@/hooks/usePairings', () => ({ usePairings: () => ({ data: [] }) }));
jest.mock('@/hooks/useClosestClassic', () => ({ useClosestClassic: () => ({ data: null }) }));
jest.mock('@/hooks/useIngredientUse', () => ({ useIngredientUse: () => ({ data: 0 }) }));
jest.mock('@/hooks/useDiscover', () => ({ useDrinkLists: () => ({ data: [] }) }));
jest.mock('@/hooks/useStartFromClassic', () => ({ useStartFromClassic: () => ({ mutate: jest.fn(), isPending: false }) }));
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ venues: [] }) }));
jest.mock('@/hooks/useKit', () => ({ useKit: () => ({ owned: [], kit: new Set(), toggle: jest.fn() }) }));
jest.mock('@/hooks/useBarKit', () => ({ useMakingKit: () => ({ kit: new Set(), where: 'My Bar', add: jest.fn() }) }));

const CAMPARI = { id: 'campari', name: 'Campari' };
const stepBack = jest.fn(() => true);

function Wizard() {
  const [draft, setDraft] = useState<WizardDraft>({ ...EMPTY_DRAFT, name: 'Ash Garden' });
  return (
    <WizardFrame testID="frame" pageTitle="Add a drink" band={() => <Text>Band</Text>} stepKey="ingredients" direction={1} eyebrow="Ash Garden" title="What goes in?" footer={<Text>Next: method</Text>} onHardwareBack={stepBack}>
      <IngredientsStep draft={draft} set={(c) => setDraft((d) => ({ ...d, ...c }))} ingredients={[CAMPARI]} />
    </WizardFrame>
  );
}

// The frame's latest back listener, as Android would call it.
let pressBack: () => unknown = () => false;
jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
  pressBack = () => handler(undefined as never);
  return { remove: jest.fn() };
});

const field = () => screen.getByLabelText('Add an ingredient');
const takenOver = () => !screen.queryByText('What goes in?') && !screen.queryByText('Band') && !screen.queryByText('Next: method');

async function open() {
  await renderWithTamagui(<Wizard />);
  // iOS draws the frame after its first layout.
  await fireEvent(screen.getByTestId('frame'), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } } });
}

describe('the ingredient search takes over a phone’s wizard (Q16)', () => {
  beforeEach(() => stepBack.mockClear());

  test('a tap on the field hides the band, heading and footer; a pick gives the step back with the line', async () => {
    await open();
    expect(takenOver()).toBe(false);
    await fireEvent(field(), 'focus');
    expect(takenOver()).toBe(true);
    expect(screen.getByText('Adding to Ash Garden')).toBeTruthy();

    await fireEvent.changeText(field(), 'camp');
    await fireEvent.press(screen.getByRole('button', { name: 'Campari' }));
    expect(screen.getByLabelText(/^Campari, /)).toBeTruthy();
    expect(takenOver()).toBe(false);
    expect(screen.queryByText('Cancel')).toBeNull();
  });

  test('Cancel adds nothing and empties the field', async () => {
    await open();
    await fireEvent(field(), 'focus');
    await fireEvent.changeText(field(), 'pine');
    await fireEvent.press(screen.getByLabelText('Cancel, add nothing'));
    expect(screen.queryByLabelText('In the drink')).toBeNull();
    expect(takenOver()).toBe(false);
    expect(field().props.value).toBe('');
  });

  test('Android’s back closes the search before it steps back', async () => {
    await open();
    await fireEvent(field(), 'focus');
    await fireEvent.changeText(field(), 'pine');
    await act(() => void pressBack());
    expect(takenOver()).toBe(false);
    expect(stepBack).not.toHaveBeenCalled();
    expect(field().props.value).toBe('');
    await act(() => void pressBack());
    expect(stepBack).toHaveBeenCalledTimes(1);
  });
});
