import { fireEvent, screen } from '@testing-library/react-native';

import { CocktailIngredientList } from '@/components/cocktail/CocktailIngredientList';
import { renderWithTamagui } from '@/jest.setup';

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
