import { fireEvent, screen } from '@testing-library/react-native';

import type { IngredientEditor, IngredientForm } from '@/hooks/useIngredientEditor';
import { renderWithTamagui } from '@/jest.setup';

import { IngredientEditPage } from './IngredientEditPage';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), usePreventRemove: () => jest.fn() }));
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ active: null, venues: [] }) }));
jest.mock('@/hooks/useMode', () => ({ useMode: () => ({ mode: 'home' }) }));
jest.mock('@/components/tools/ToolsSheet', () => ({ PrepCalcButton: () => null }));
jest.mock('../drink/edit/EditSpecList', () => ({ EditSpecList: () => null }));
jest.mock('./IngredientEditSheets', () => {
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    ...jest.requireActual('./IngredientEditSheets'),
    // The search itself is the wizard's (tested there): here, picking Gin.
    FindSheet: ({ title, onPick }: { title: string; onPick: (p: { id: string; name: string }) => void }) => (
      <Pressable role="button" accessibilityLabel={`${title}: Gin`} onPress={() => onPick({ id: 'gin', name: 'Gin' })}>
        <Text>{title}</Text>
      </Pressable>
    ),
  };
});
jest.mock('@/components/ds/IngredientDrawing', () => ({ IngredientDrawing: () => null }));

const FORM: IngredientForm = {
  name: 'Tanqueray',
  description: '',
  brandMaker: '',
  generic: null,
  abv: '',
  selectedCategories: ['c-gin'],
  recipeItems: [],
  barId: null,
  overrideVisibility: null,
  overrideGeneric: null,
  overrideSpecific: null,
  overrideMeasurement: null,
  overridePrep: null,
  hideFromSearch: false,
};

function editorWith(form: IngredientForm, set: jest.Mock) {
  return {
    form,
    set,
    setRecipeItems: jest.fn(),
    saving: false,
    selfId: 'tanq',
    draftId: null,
    catalog: [],
    saveDraft: jest.fn(),
    dropdowns: {
      ingredients: [{ id: 'gin', name: 'Gin' }],
      categories: [
        { id: 'c-gin', name: 'Gin', domain: 'spirit' },
        { id: 'c-rum', name: 'Rum', domain: 'spirit' },
        { id: 'c-ipa', name: 'IPA', domain: 'beer' },
      ],
    },
  } as unknown as IngredientEditor;
}

describe('IngredientEditPage', () => {
  test('edits what it is: kind of, maker, tags and search', async () => {
    const set = jest.fn();
    await renderWithTamagui(<IngredientEditPage editor={editorWith(FORM, set)} eyebrow="INGREDIENT" onBack={jest.fn()} onSave={jest.fn()} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Choose what it’s a kind of' }));
    await fireEvent.press(screen.getByRole('button', { name: 'What it’s a kind of: Gin' }));
    expect(set).toHaveBeenLastCalledWith({ generic: { id: 'gin', name: 'Gin' } });

    await fireEvent.changeText(screen.getByLabelText('Maker'), 'tanqueray');
    expect(set).toHaveBeenLastCalledWith({ brandMaker: 'Tanqueray' });

    // Only spirit tags; a picked one shows as a chip, and pressing it takes it off.
    expect(screen.queryByText('IPA')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Gin, remove'));
    expect(set).toHaveBeenLastCalledWith({ selectedCategories: [] });

    await fireEvent(screen.getByLabelText('Hide in search'), 'valueChange', true);
    expect(set).toHaveBeenLastCalledWith({ hideFromSearch: true });
  });

  test('a draft offers Publish, and its Save says what it saves', async () => {
    const onPublish = jest.fn();
    await renderWithTamagui(<IngredientEditPage editor={editorWith(FORM, jest.fn())} eyebrow="DRAFT" onBack={jest.fn()} onSave={jest.fn()} saveLabel="Save draft" onPublish={onPublish} />);
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Publish ingredient' }));
    expect(onPublish).toHaveBeenCalled();
  });
});
