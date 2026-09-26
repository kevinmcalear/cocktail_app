import { fireEvent, screen } from '@testing-library/react-native';
import { useKeepAwake } from 'expo-keep-awake';
import type { ComponentProps } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { CocktailDetailContent } from '@/components/cocktail/CocktailDetailContent';
import { renderWithTamagui } from '@/jest.setup';
import { useAppStore } from '@/store/useAppStore';
import { getPreferredUnit, useSettingsStore } from '@/store/useSettingsStore';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/hooks/useDrafts', () => ({ useDrafts: () => ({ drafts: [], saveDraft: jest.fn() }) }));
jest.mock('@/hooks/useBars', () => ({ useBars: () => ({ data: [] }) }));
jest.mock('@/hooks/useRecipeMergeHandler', () => ({ useRecipeMergeHandler: () => ({ onMerge: jest.fn() }) }));

type Props = ComponentProps<typeof CocktailDetailContent>;
type Editor = NonNullable<Props['editor']>;

const cocktail = {
  id: 'c1',
  item_methods: [{ method: { name: 'Shaken' } }],
  glassware: { name: 'Coupe' },
  origin: 'Classic',
  description: 'Bright and sour.',
  notes: 'Double strain.',
  recipes: [
    { id: 'r1', amount: '2', unit: 'oz', ingredient: { id: 'gin', name: 'Gin' } },
    // Role-masked: the viewer can't see which ingredient this is.
    { id: 'r2', amount: '0.75', unit: 'oz', ingredient: null, display_ingredient_id: null },
  ],
};

// Only the fields CocktailDetailContent and its children read in edit mode.
function makeEditor(): Editor {
  return {
    recipeItems: [],
    setRecipeItems: jest.fn(),
    description: '',
    setDescription: jest.fn(),
    notes: '',
    setNotes: jest.fn(),
    allIngredients: [],
    methods: [],
    glassware: [],
    families: [],
    iceTypes: [],
    origin: '',
    getSpecId: () => null,
    barId: null,
  } as unknown as Editor;
}

// Edit mode's drag handles are GestureDetectors, which need the root view
// app/_layout.tsx provides.
const renderContent = (props: Partial<Props> = {}) =>
  renderWithTamagui(
    <GestureHandlerRootView>
      <CocktailDetailContent cocktail={cocktail} isEditing={false} {...props} />
    </GestureHandlerRootView>
  );

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({ serviceMode: false });
  useAppStore.setState({ recentlyCreatedItem: null });
});

describe('view mode', () => {
  test('shows the specs, a Spec heading and the ingredient rows', async () => {
    await renderContent();

    expect(screen.getByRole('group', { name: 'Method: Shaken' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Glassware: Coupe' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Spec' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '2 oz Gin' })).toBeTruthy();
    expect(screen.getByLabelText('0.75 oz Hidden ingredient')).toBeTruthy();
    expect(screen.getByText('Bright and sour.')).toBeTruthy();
  });

  test('tapping an ingredient opens it, unless the screen handles the tap', async () => {
    await renderContent();
    await fireEvent.press(screen.getByRole('button', { name: '2 oz Gin' }));
    expect(mockPush).toHaveBeenCalledWith('/ingredient/gin');
    await screen.unmount();

    const onIngredientPress = jest.fn();
    await renderContent({ onIngredientPress });
    await fireEvent.press(screen.getByRole('button', { name: '2 oz Gin' }));
    expect(onIngredientPress).toHaveBeenCalledWith('gin');
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  test('service mode is a switch that keeps the screen awake while on', async () => {
    await renderContent();
    const serviceMode = (checked: boolean) => screen.getByRole('switch', { name: 'Service mode', checked });

    expect(serviceMode(false)).toBeTruthy();
    expect(useKeepAwake).not.toHaveBeenCalled();

    await fireEvent.press(serviceMode(false));
    expect(serviceMode(true)).toBeTruthy();
    expect(useKeepAwake).toHaveBeenCalledWith('service-mode');

    jest.mocked(useKeepAwake).mockClear();
    await fireEvent.press(serviceMode(true));
    expect(serviceMode(false)).toBeTruthy();
    expect(useKeepAwake).not.toHaveBeenCalled();
  });

  test('notes start collapsed and open on tap', async () => {
    await renderContent();

    expect(screen.queryByText('Double strain.')).toBeNull();
    await fireEvent.press(screen.getByText('Notes'));
    expect(screen.getByText('Double strain.')).toBeTruthy();
  });

  test('a cocktail with no recipe, description or notes shows only its specs', async () => {
    await renderContent({ cocktail: { ...cocktail, recipes: [], description: null, notes: null } });

    expect(screen.getByRole('group', { name: 'Method: Shaken' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Spec' })).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByText('Notes')).toBeNull();
  });
});

test('the panel prefers the nested handler and ignores taps on hidden ingredients', async () => {
  const onNestedItemPress = jest.fn();
  const onIngredientPress = jest.fn();
  await renderContent({ variant: 'panel', onNestedItemPress, onIngredientPress });

  await fireEvent.press(screen.getByText('Gin'));
  await fireEvent.press(screen.getByText('Hidden ingredient'));
  expect(onNestedItemPress.mock.calls).toEqual([['gin']]);
  expect(onIngredientPress).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
});

describe('edit mode', () => {
  test('a newly created ingredient is attached to the cocktail that asked for it', async () => {
    useAppStore.setState({
      recentlyCreatedItem: { type: 'ingredient', id: 'lime', name: 'Lime Juice', targetId: 'c1' },
    });
    const editor = makeEditor();
    await renderContent({ isEditing: true, editor });

    const update = jest.mocked(editor.setRecipeItems).mock.calls[0][0] as unknown as (prev: unknown[]) => unknown[];
    expect(update([])).toEqual([
      expect.objectContaining({ ingredient_id: 'lime', name: 'Lime Juice', amount: '', unit: getPreferredUnit() }),
    ]);
    expect(useAppStore.getState().recentlyCreatedItem).toBeNull();
  });

  test('an ingredient created for another cocktail is left alone', async () => {
    const handoff = { type: 'ingredient' as const, id: 'lime', name: 'Lime Juice', targetId: 'other' };
    useAppStore.setState({ recentlyCreatedItem: handoff });
    const editor = makeEditor();
    await renderContent({ isEditing: true, editor });

    expect(editor.setRecipeItems).not.toHaveBeenCalled();
    expect(useAppStore.getState().recentlyCreatedItem).toEqual(handoff);
  });

  test('description edits go to the editor', async () => {
    const editor = makeEditor();
    await renderContent({ isEditing: true, editor });

    await fireEvent.changeText(screen.getByPlaceholderText('Add a description...'), 'Tart.');
    expect(editor.setDescription).toHaveBeenCalledWith('Tart.');
  });
});
