import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { EMPTY_DRAFT, type WizardDraft } from '@/lib/drinkWizard';

import { FinishStep } from './FinishStep';

const SHELF = [
  { id: 'agrumato', name: 'Agrumato Mint Oil' },
  { id: 'absinthe', name: 'Absinthe' },
];
const daiquiri: WizardDraft = { ...EMPTY_DRAFT, name: 'Coconut Fat-Washed Daiquiri' };
const finish = (set: jest.Mock) => set.mock.calls.at(-1)[0].garnishes;

describe('FinishStep', () => {
  test('drops of oil: the chip asks which in the field, and the line starts at 3 drops', async () => {
    const set = jest.fn();
    await renderWithTamagui(<FinishStep draft={daiquiri} set={set} ingredients={SHELF} />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Drops of oil' }));
    await fireEvent.changeText(screen.getByLabelText('Drops of what oil?'), 'agrumato mint oil');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(finish(set).map((l: { id: string; amount: string; unit: string }) => [l.id, l.amount, l.unit])).toEqual([['agrumato', '3', 'drop']]);
  });

  test('a whole chip adds its line; a garnish toggles; something else is added and shows as a chip', async () => {
    const set = jest.fn();
    await renderWithTamagui(<FinishStep draft={daiquiri} set={set} ingredients={SHELF} />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Absinthe rinse' }));
    expect(finish(set).map((l: { id: string; amount: string; unit: string }) => [l.id, l.amount, l.unit])).toEqual([['absinthe', '1', 'rinse']]);
    // Every garnish is in sight: no More.
    expect(screen.getByRole('checkbox', { name: 'Edible flower' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();

    await fireEvent.changeText(screen.getByLabelText('Something else'), 'Dehydrated lime');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(finish(set).at(-1)).toMatchObject({ id: null, name: 'Dehydrated lime', unit: 'each', amount: '1' });

    const lines = [{ key: 'o', id: null, name: 'Mint oil', amount: '3', unit: 'drop' }, { key: 'p', id: null, name: 'Orange', amount: '1', unit: 'peel' }];
    await renderWithTamagui(<FinishStep draft={{ ...daiquiri, garnishes: lines }} set={set} ingredients={SHELF} />);
    expect(screen.getByRole('checkbox', { name: 'Orange peel', checked: true })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: '3 drops Mint oil', checked: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Orange peel' }));
    expect(finish(set).map((l: { name: string }) => l.name)).toEqual(['Mint oil']);
    expect(screen.getByText('Garnishes go at the end of the spec.')).toBeTruthy();
  });
});
