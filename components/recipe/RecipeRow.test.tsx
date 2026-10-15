import { fireEvent, screen } from '@testing-library/react-native';

import { BackbarTheme } from '@/components/ds';
import { renderWithTamagui } from '@/jest.setup';

import { RecipeRow } from './RecipeRow';

const item = { ingredient_id: 'i1', name: 'Pineapple', amount: '300', unit: 'g' };

test('a recipe line edits its amount and unit, renames, and removes itself', async () => {
  const onUpdateItem = jest.fn();
  const onRemove = jest.fn();
  const onRenameIngredient = jest.fn();
  await renderWithTamagui(
    <BackbarTheme>
      <RecipeRow item={item} index={2} drag={jest.fn()} isActive={false} isMergeTarget={false} isMergePending onUpdateItem={onUpdateItem} onRemove={onRemove} onRenameIngredient={onRenameIngredient} draftBadge={null} />
    </BackbarTheme>
  );

  expect(screen.getByText('Hold to combine…')).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText('Amount of Pineapple'), '250');
  expect(onUpdateItem).toHaveBeenLastCalledWith(2, { amount: '250' });

  await fireEvent.press(screen.getByLabelText('Unit: g'));
  await fireEvent.press(await screen.findByLabelText('oz'));
  expect(onUpdateItem).toHaveBeenLastCalledWith(2, { unit: 'oz' });

  await fireEvent.press(screen.getByLabelText('Pineapple. Rename it'));
  await fireEvent(screen.getByLabelText('Ingredient name'), 'blur');
  // Unchanged: nothing to rename.
  expect(onRenameIngredient).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByLabelText('Remove Pineapple'));
  expect(onRemove).toHaveBeenCalledWith(2);
});
