import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { EMPTY_DRAFT } from '@/lib/drinkWizard';

import { IngredientsStep } from './IngredientsStep';

// Pairings come from the database; these tests are about the field.
jest.mock('@/hooks/usePairings', () => ({ usePairings: () => ({ data: [] }) }));

const CAMPARI = { id: 'campari', name: 'Campari', item_images: [{ images: { url: 'https://example.test/campari.jpg' } }] };

describe('IngredientsStep', () => {
  test('while the list loads, a typed name is never added as a new ingredient', async () => {
    const set = jest.fn();
    await renderWithTamagui(<IngredientsStep draft={EMPTY_DRAFT} set={set} ingredients={[]} loading />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'Campari');

    expect(screen.getByText('Loading ingredients…')).toBeTruthy();
    expect(screen.queryByText(/as new/)).toBeNull();
    await fireEvent(screen.getByLabelText('Add an ingredient'), 'submitEditing');
    expect(set).not.toHaveBeenCalled();
  });

  test('once loaded, it finds the bottle and still offers a new one', async () => {
    const set = jest.fn();
    await renderWithTamagui(<IngredientsStep draft={EMPTY_DRAFT} set={set} ingredients={[CAMPARI]} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'camp');

    expect(screen.getByRole('button', { name: /as new/ })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Campari' }));
    expect(set.mock.calls[0][0].lines[0]).toMatchObject({ id: 'campari', name: 'Campari' });
  });
});
