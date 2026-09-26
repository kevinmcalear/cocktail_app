import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { CocktailIngredientList } from '@/components/cocktail/CocktailIngredientList';
import type { SortableRecipeItem } from '@/components/recipe/SortableRecipeList';
import { renderWithTamagui } from '@/jest.setup';
import { useSettingsStore } from '@/store/useSettingsStore';

const recipes = [
  { id: 'r1', amount: '2', unit: 'oz', ingredient: { id: 'gin', name: 'Gin' } },
  { id: 'r2', amount: '0.75', unit: 'oz', ingredient: null, display_ingredient_id: 'syrup' },
  // Role-masked: the viewer's role can't see which ingredient this is.
  { id: 'r3', amount: '2', unit: 'dashes', ingredient: null, display_ingredient_id: null },
];

test('spec rows read as amount + ingredient and only open when there is an ingredient to open', async () => {
  const onIngredientPress = jest.fn();
  await renderWithTamagui(
    <CocktailIngredientList
      isEditing={false}
      viewRecipes={recipes}
      ingredientImageMap={{}}
      onIngredientPress={onIngredientPress}
    />
  );

  expect(screen.getAllByRole('button').map((el) => el.props.accessibilityLabel)).toEqual([
    '2 oz Gin',
    '0.75 oz Unknown Ingredient',
  ]);
  const hidden = screen.getByLabelText('2 dashes Hidden ingredient');
  expect(hidden.props.accessibilityRole).toBeUndefined();

  await fireEvent.press(screen.getByRole('button', { name: '2 oz Gin' }));
  await fireEvent.press(hidden);
  expect(onIngredientPress.mock.calls).toEqual([['gin']]);
});

describe('edit mode', () => {
  const gin: SortableRecipeItem = { id: 'l1', ingredient_id: 'gin', name: 'Gin', amount: '2', unit: 'oz' };
  const lime: SortableRecipeItem = { id: 'l2', ingredient_id: 'lime', name: 'Lime Juice', amount: '', unit: '' };

  const handlers = () => ({
    onReorder: jest.fn(),
    onUpdateItem: jest.fn(),
    onRemove: jest.fn(),
    onIngredientPress: jest.fn(),
    onRenameIngredient: jest.fn(),
  });

  // Applies row updates back into the list, like the cocktail editor does.
  function EditList({ items, ...props }: { items: SortableRecipeItem[] } & ReturnType<typeof handlers>) {
    const [editItems, setEditItems] = useState(items);
    return (
      <CocktailIngredientList
        isEditing
        editItems={editItems}
        ingredientImageMap={{ gin: 'https://example.com/gin.png' }}
        {...props}
        onUpdateItem={(index, updates) => {
          props.onUpdateItem(index, updates);
          setEditItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...updates } : item)));
        }}
      />
    );
  }

  const list = (items: SortableRecipeItem[], props: ReturnType<typeof handlers>) => (
    <CocktailIngredientList isEditing editItems={items} ingredientImageMap={{}} {...props} />
  );

  beforeEach(() => useSettingsStore.setState({ defaultUnit: 'ml' }));

  test('each row shows its measure, name and controls', async () => {
    const props = handlers();
    await renderWithTamagui(<EditList items={[gin, lime]} {...props} />);

    expect(screen.getByText('2 oz')).toBeTruthy();
    // No unit saved yet: shows the default unit.
    expect(screen.getByText('ml')).toBeTruthy();
    expect(screen.getAllByLabelText('Drag to reorder')).toHaveLength(2);
    expect(screen.getByLabelText('Open ingredient')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Add ingredient photo'));
    expect(props.onIngredientPress).toHaveBeenCalledWith('lime');
    await fireEvent.press(screen.getAllByLabelText('Remove ingredient')[1]);
    expect(props.onRemove).toHaveBeenCalledWith(1);
  });

  test('amount and unit edits update only that row', async () => {
    const props = handlers();
    await renderWithTamagui(<EditList items={[gin, lime]} {...props} />);

    await fireEvent.press(screen.getByText('2 oz'));
    await fireEvent.changeText(screen.getByPlaceholderText('Amount'), '1.5');
    expect(props.onUpdateItem).toHaveBeenLastCalledWith(0, { amount: '1.5' });

    await fireEvent.press(screen.getByLabelText('Unit: oz'));
    await fireEvent.press(screen.getByText('cl'));
    expect(props.onUpdateItem).toHaveBeenLastCalledWith(0, { unit: 'cl' });
  });

  test('renaming commits a capitalised name and renames the ingredient', async () => {
    const props = handlers();
    await renderWithTamagui(<EditList items={[gin, lime]} {...props} />);

    await fireEvent.press(screen.getByText('Lime Juice'));
    await fireEvent.changeText(screen.getByPlaceholderText('Ingredient name'), '  fresh lime ');
    await fireEvent(screen.getByPlaceholderText('Ingredient name'), 'submitEditing');

    expect(props.onUpdateItem).toHaveBeenLastCalledWith(1, { name: 'Fresh Lime' });
    expect(props.onRenameIngredient.mock.calls).toEqual([['lime', 'Fresh Lime']]);
    expect(screen.getByText('Fresh Lime')).toBeTruthy();
  });

  test('clearing a name puts the old one back without renaming', async () => {
    const props = handlers();
    await renderWithTamagui(<EditList items={[gin, lime]} {...props} />);

    await fireEvent.press(screen.getByText('Gin'));
    await fireEvent.changeText(screen.getByPlaceholderText('Ingredient name'), '   ');
    await fireEvent(screen.getByPlaceholderText('Ingredient name'), 'submitEditing');

    expect(props.onUpdateItem).toHaveBeenLastCalledWith(0, { name: 'Gin' });
    expect(props.onRenameIngredient).not.toHaveBeenCalled();
    expect(screen.getByText('Gin')).toBeTruthy();
  });

  test('a newly added row opens its amount for entry', async () => {
    const props = handlers();
    await renderWithTamagui(list([gin], props));
    expect(screen.queryByPlaceholderText('Amount')).toBeNull();

    await screen.rerender(list([gin, lime], props));
    expect(screen.getByPlaceholderText('Amount').props.value).toBe('');
    expect(screen.getByText('2 oz')).toBeTruthy();
  });

  test('a batch created by a merge opens its name for editing', async () => {
    const props = handlers();
    await renderWithTamagui(list([gin, lime], props));

    const batch = { id: 'l3', ingredient_id: 'batch-1', name: 'New batch', amount: '', unit: '' };
    await screen.rerender(list([batch], props));
    expect(screen.getByPlaceholderText('Ingredient name').props.value).toBe('New batch');
    expect(screen.queryByPlaceholderText('Amount')).toBeNull();
  });
});
