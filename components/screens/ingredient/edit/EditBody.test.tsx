import { fireEvent, screen } from '@testing-library/react-native';

import type { IngredientForm } from '@/hooks/useIngredientEditor';
import { renderWithTamagui } from '@/jest.setup';
import { prepFields } from '@/lib/prepCardForm';

import { EditBody } from './EditBody';
import type { IngredientEdit } from './useIngredientEdit';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), usePreventRemove: () => jest.fn() }));
jest.mock('@/hooks/useNearIngredients', () => ({ useNearIngredients: () => [] }));
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ active: null, venues: [] }) }));
jest.mock('@/hooks/useMode', () => ({ useMode: () => ({ mode: 'home' }) }));
jest.mock('../../drink/edit/EditLines', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { EditLines: ({ title, aside }: { title: string; aside?: string }) => <Text>{[title, aside].filter(Boolean).join(' · ')}</Text> };
});
// The venue rows read the venue's data: covered where they're used.
jest.mock('./EditSections', () => ({ ...jest.requireActual('./EditSections'), WhereEdit: () => null, WhoSees: () => null }));
jest.mock('./PrepSections', () => ({ ...jest.requireActual('./PrepSections'), PrepCost: () => null }));
jest.mock('./BottleSections', () => ({ ...jest.requireActual('./BottleSections'), BottlePrice: () => null }));
// The drag list renders its rows in a plain column here (its gestures don't run in Jest).
jest.mock('react-native-draggable-flatlist', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const List = ({ data, renderItem }: { data: unknown[]; renderItem: (p: { item: unknown; drag: () => void; isActive: boolean; getIndex: () => number }) => React.ReactNode }) => <View>{data.map((item, i) => <View key={i}>{renderItem({ item, drag: () => undefined, isActive: false, getIndex: () => i })}</View>)}</View>;
  return { __esModule: true, default: List, NestableDraggableFlatList: List, ScaleDecorator: ({ children }: { children: React.ReactNode }) => children };
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
  picture: 'drawing',
  photo: null,
};
const TAGS = [
  { id: 'c-gin', name: 'Gin' },
  { id: 'c-rum', name: 'Rum' },
];

function editWith(form: IngredientForm, set: jest.Mock, setPrep = jest.fn()) {
  const prep = prepFields({ prep: { yield_amount: 750, yield_unit: 'ml', shelf_life_hours: 672, lead_time_minutes: 20, lead_time_note: null, storage: 'Fridge', actions: [] }, steps: [{ body: 'Heat the honey', timer_seconds: null }] });
  return {
    editor: { form, set, setRecipeItems: jest.fn(), role: null, selfId: 'i1', dropdowns: { ingredients: [] }, catalog: [] },
    prep,
    setPrep,
    onPending: jest.fn(),
  } as unknown as IngredientEdit;
}

const render = (edit: IngredientEdit, isPrep: boolean, onSheet = jest.fn()) =>
  renderWithTamagui(<EditBody edit={edit} savedId="i1" isPrep={isPrep} wide={false} venueName={null} used={3} spiritTags={TAGS} onSheet={onSheet} selfId="i1" />);

describe('EditBody', () => {
  test('a bottle edits what it is and its tags, no recipe', async () => {
    const set = jest.fn();
    const onSheet = jest.fn();
    await render(editWith(FORM, set), false, onSheet);

    expect(screen.queryByText(/^Recipe/)).toBeNull();
    expect(screen.queryByText('Method')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Kind of, Add' }));
    expect(onSheet).toHaveBeenLastCalledWith('kind');

    await fireEvent.changeText(screen.getByLabelText('Maker'), 'tanqueray');
    expect(set).toHaveBeenLastCalledWith({ brandMaker: 'Tanqueray' });

    // A picked tag shows as a chip, and pressing it takes it off; + Add opens the rest.
    expect(screen.queryByText('Rum')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Gin, remove'));
    expect(set).toHaveBeenLastCalledWith({ selectedCategories: [] });
    await fireEvent.press(screen.getByText('+ Add'));
    expect(onSheet).toHaveBeenLastCalledWith('tags');
  });

  test('a house prep edits its recipe, method and how it keeps', async () => {
    const setPrep = jest.fn();
    const onSheet = jest.fn();
    await render(editWith({ ...FORM, name: 'Burnt Honey Syrup' }, jest.fn(), setPrep), true, onSheet);

    expect(screen.getByText('Recipe · Makes about 750 ml')).toBeTruthy();
    expect(screen.queryByLabelText('Maker')).toBeNull();
    expect(screen.getByText('1 step · 20 min')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Add a step to the method' }));
    expect(setPrep.mock.calls.at(-1)[0].steps).toHaveLength(2);

    await fireEvent.press(screen.getByRole('link', { name: 'Keeps, 4 weeks' }));
    expect(onSheet).toHaveBeenLastCalledWith('keeps');
  });
});
