import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { PrepBuilder } from './PrepBuilder';

jest.mock('@/hooks/useKit', () => ({ useKit: () => ({ owned: [], kit: new Set(), toggle: jest.fn() }) }));

// The builder draws after its first layout, as the wizard does on iOS.
const laidOut = () => fireEvent(screen.getByTestId('add-prep'), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });
const open = async (name: string, onDone = jest.fn()) => {
  await renderWithTamagui(<PrepBuilder name={name} drinkName="Daiquiri" ingredients={[]} onDone={onDone} onClose={jest.fn()} />);
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
    expect(screen.getByText('2 weeks')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Add it to Daiquiri' }));
    const prep = onDone.mock.calls[0][0];
    expect(prep.technique).toBe('fat-wash');
    expect(prep.lines.map((l: { name: string }) => l.name)).toEqual(['Rum']);
    expect(prep.lines.some((l: { slot?: string }) => l.slot)).toBe(false);
  });
});
