import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { EMPTY_DRAFT, type WizardDraft } from '@/lib/drinkWizard';

import { FinishStep } from './FinishStep';

jest.mock('@/hooks/useKit', () => ({ useKit: () => ({ owned: [], kit: new Set(), toggle: jest.fn() }) }));

// The prep builder draws after its first layout, as the wizard does on iOS.
const laidOut = () => fireEvent(screen.getByTestId('add-prep'), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });

const SHELF = [
  { id: 'agrumato', name: 'Agrumato Mint Oil' },
  { id: 'absinthe', name: 'Absinthe' },
  { id: 'peychaud', name: 'Peychaud’s Bitters' },
];
const daiquiri: WizardDraft = { ...EMPTY_DRAFT, name: 'Coconut Fat-Washed Daiquiri' };
const finish = (set: jest.Mock) => set.mock.calls.at(-1)[0].garnishes;

describe('FinishStep', () => {
  test('drops of oil: the chip asks which, and the line starts at 3 drops', async () => {
    const set = jest.fn();
    await renderWithTamagui(<FinishStep draft={daiquiri} set={set} ingredients={SHELF} />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Drops of oil' }));
    await fireEvent.changeText(screen.getByLabelText('Drops of what oil?'), 'agrumato');
    await fireEvent.press(screen.getByRole('button', { name: 'Agrumato Mint Oil' }));
    expect(finish(set).map((l: { id: string; amount: string; unit: string }) => [l.id, l.amount, l.unit])).toEqual([['agrumato', '3', 'drop']]);
  });

  test('mint oil made in house from the finish: the herb oil, kept 4 days cold, on as 3 drops', async () => {
    const set = jest.fn();
    await renderWithTamagui(<FinishStep draft={daiquiri} set={set} ingredients={SHELF} />);
    await fireEvent.changeText(screen.getByLabelText('Add to the finish'), 'mint oil');
    // Made first, before the bottle that only shares the words.
    const rows = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel ?? b.props['aria-label']);
    expect(rows.indexOf('Make “mint oil” in house')).toBeLessThan(rows.indexOf('Agrumato Mint Oil'));

    await fireEvent.press(screen.getByRole('button', { name: 'Make “mint oil” in house' }));
    await laidOut();
    expect(screen.getByRole('radio', { name: /^Herb, chile and garlic oils/, checked: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Next: recipe' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next: method' }));
    expect(screen.getByText('4 days')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Add it to Coconut Fat-Washed Daiquiri' }));

    const [line] = finish(set);
    expect(line).toMatchObject({ id: null, name: 'Mint Oil', unit: 'drop', amount: '3', technique: 'infused-oil' });
    expect(line.prep.technique).toBe('infused-oil');
    expect(line.prep.keepsHours).toBe(96);
  });

  test('a whole chip adds its line; a garnish toggles; a finish line offers finish units', async () => {
    const set = jest.fn();
    await renderWithTamagui(<FinishStep draft={daiquiri} set={set} ingredients={SHELF} />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Absinthe rinse' }));
    expect(finish(set).map((l: { id: string; amount: string; unit: string }) => [l.id, l.amount, l.unit])).toEqual([['absinthe', '1', 'rinse']]);

    const lines = [{ key: 'o', id: null, name: 'Mint oil', amount: '3', unit: 'drop' }, { key: 'p', id: null, name: 'Orange', amount: '1', unit: 'peel' }];
    await renderWithTamagui(<FinishStep draft={{ ...daiquiri, garnishes: lines }} set={set} ingredients={SHELF} />);
    expect(screen.getByRole('checkbox', { name: 'Orange peel', checked: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Orange peel' }));
    expect(finish(set).map((l: { name: string }) => l.name)).toEqual(['Mint oil']);

    await fireEvent.press(screen.getByRole('button', { name: 'More Mint oil' }));
    expect(finish(set)[0].amount).toBe('4');
    await fireEvent.press(screen.getByRole('button', { name: 'Unit: drop' }));
    expect(screen.getByRole('radio', { name: 'spray' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'ml' })).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'float' }));
    expect(finish(set)[0]).toMatchObject({ name: 'Mint oil', unit: 'float', amount: '3' });
  });
});
