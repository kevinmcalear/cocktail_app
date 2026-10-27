import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { SortableRecipeItem } from '@/lib/recipeItem';

import { EditLines } from './EditLines';

// The search reads the database for near names and use counts; these tests are about the lines.
jest.mock('@/hooks/useNearIngredients', () => ({ useNearIngredients: () => [] }));
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ venues: [] }) }));
jest.mock('@/hooks/useKit', () => ({ useKit: () => ({ owned: [], kit: new Set(), toggle: jest.fn() }) }));
jest.mock('@/hooks/useBarKit', () => ({ useMakingKit: () => ({ kit: new Set(), where: 'My Bar', add: jest.fn() }) }));
jest.mock('@/hooks/usePrepCard', () => ({ ...jest.requireActual('@/hooks/usePrepCard'), useCatalogRecipe: () => ({ data: null }) }));

const SPEC: SortableRecipeItem[] = [
  { id: 'row1', ingredient_id: 'scotch', name: 'Blended Scotch', amount: '60', unit: 'ml', preparation_notes: '', is_optional: false },
  { id: 'row2', ingredient_id: 'islay', name: 'Islay Scotch', amount: '7.5', unit: 'ml', preparation_notes: 'floated on top', is_optional: true },
];
const CATALOG = [
  { id: 'scotch', name: 'Blended Scotch' },
  { id: 'islay', name: 'Islay Scotch' },
  { id: 'lemon', name: 'Lemon juice' },
];

const render = (onChange: jest.Mock, forDrink = true) =>
  renderWithTamagui(<EditLines items={SPEC} onChange={onChange} name="Penicillin" ingredients={CATALOG} bar={null} forDrink={forDrink} />);

describe('EditLines', () => {
  test("a drink's spec is the making flow's list: lines combine, and New's suggestions stay in New", async () => {
    await render(jest.fn());
    expect(screen.getByText('Spec')).toBeTruthy();
    expect(screen.getByLabelText('Amount of Blended Scotch')).toBeTruthy();
    expect(screen.getByText('Hold a line by its grip and move it over another. Let go to combine them; move away to just reorder.')).toBeTruthy();
    expect(screen.queryByText('Paste a whole spec')).toBeNull();
    // A saved note shows as the line's note.
    expect(screen.getByDisplayValue('floated on top')).toBeTruthy();
  });

  test('an edit keeps each saved row, its note and whether it is optional', async () => {
    const onChange = jest.fn();
    await render(onChange);
    await fireEvent.press(screen.getByRole('button', { name: 'More Blended Scotch' }));
    const items = onChange.mock.calls.at(-1)[0] as SortableRecipeItem[];
    expect(items[0]).toMatchObject({ id: 'row1', ingredient_id: 'scotch', unit: 'ml' });
    expect(items[0].amount).not.toBe('60');
    expect(items[1]).toMatchObject({ id: 'row2', ingredient_id: 'islay', amount: '7.5', preparation_notes: 'floated on top', is_optional: true });
  });

  test('a line added from the search comes back as a row to save', async () => {
    const onChange = jest.fn();
    await render(onChange);
    await fireEvent.changeText(screen.getByLabelText('Add another ingredient'), 'lemon');
    await fireEvent.press(screen.getByRole('button', { name: 'Lemon juice' }));
    const items = onChange.mock.calls.at(-1)[0] as SortableRecipeItem[];
    expect(items).toHaveLength(3);
    expect(items[2]).toMatchObject({ id: undefined, ingredient_id: 'lemon', name: 'Lemon juice' });
  });

  test("an ingredient's recipe reorders only, as in New", async () => {
    await render(jest.fn(), false);
    expect(screen.getByText('Hold a grip and move it to reorder.')).toBeTruthy();
  });
});
