import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { EMPTY_DRAFT, newLine } from '@/lib/drinkWizard';

import { IngredientsStep } from './IngredientsStep';

const mockToggle = jest.fn();
const mockShelfAdd = jest.fn();
let mockCaps: string[] = ['edit_drinks'];
let mockStocked = new Set<string>();
let mockSpots: { item_id: string }[] = [];

jest.mock('@/components/ViewAsBanner', () => ({ ViewAsPill: () => null }));
jest.mock('@/hooks/usePairings', () => ({ usePairings: () => ({ data: [] }) }));
jest.mock('@/hooks/useClosestClassic', () => ({ useClosestClassic: () => ({ data: null }) }));
jest.mock('@/hooks/useIngredientUse', () => ({ useIngredientUse: () => ({ data: 0 }) }));
jest.mock('@/hooks/useDiscover', () => ({ useDrinkLists: () => ({ data: [] }) }));
jest.mock('@/hooks/useStartFromClassic', () => ({ useStartFromClassic: () => ({ mutate: jest.fn(), isPending: false }) }));
jest.mock('@/hooks/useKit', () => ({ useKit: () => ({ owned: [], kit: new Set(), toggle: jest.fn() }) }));
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ data: mockCaps }) }));
jest.mock('@/hooks/useBackBar', () => ({ useStockedIds: () => mockStocked, useItemLocations: () => ({ data: mockSpots }) }));
jest.mock('@/hooks/useBarStock', () => ({ useStockToggle: () => ({ mutate: mockToggle }) }));
jest.mock('@/hooks/useHomeBar', () => ({ useShelf: () => ({ data: [] }), useShelfEdit: () => ({ add: { mutate: mockShelfAdd }, remove: { mutate: jest.fn() } }) }));

const INGREDIENTS = [
  { id: 'mezcal', name: 'Mezcal', ingredient_role: 'generic' },
  { id: 'vida', name: 'Del Maguey Vida', ingredient_role: 'product', generic_id: 'mezcal' },
  { id: 'lime', name: 'Lime juice', ingredient_role: 'generic' },
];
const draft = {
  ...EMPTY_DRAFT,
  name: 'Ash Garden',
  lines: [newLine({ id: 'vida', name: 'Del Maguey Vida' }, 'ml', '45'), newLine({ id: 'lime', name: 'Lime juice' }, 'ml', '22.5')],
};
const venue = { barId: 'rye', venueName: 'Little Rye' };

beforeEach(() => {
  jest.clearAllMocks();
  mockCaps = ['edit_drinks'];
  mockStocked = new Set();
  mockSpots = [];
});

describe('the bottle on a spec line', () => {
  test('one tap puts a bottle on the back bar, says so, and Undo takes it off', async () => {
    await renderWithTamagui(<IngredientsStep draft={draft} set={jest.fn()} ingredients={INGREDIENTS} bottles={venue} />);
    // Juice gets no bottle.
    expect(screen.queryByLabelText(/^Lime juice is/)).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Del Maguey Vida is not on the back bar. Add it' }));
    expect(mockToggle).toHaveBeenCalledWith({ item: { id: 'vida', name: 'Del Maguey Vida' }, on: true, from: 'Ash Garden' });
    expect(screen.getByText('Del Maguey Vida is on Little Rye’s back bar')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Undo: Del Maguey Vida is on Little Rye’s back bar' }));
    expect(mockToggle).toHaveBeenLastCalledWith({ item: { id: 'vida', name: 'Del Maguey Vida' }, on: false, from: 'Ash Garden' });
  });

  test('lit when stocked; a bottle with a spot comes off from the plan, not here', async () => {
    mockStocked = new Set(['vida']);
    mockSpots = [{ item_id: 'vida' }];
    await renderWithTamagui(<IngredientsStep draft={draft} set={jest.fn()} ingredients={INGREDIENTS} bottles={venue} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Del Maguey Vida is on Little Rye’s back bar' }));
    expect(mockToggle).not.toHaveBeenCalled();
    expect(screen.getByText('Del Maguey Vida has a spot on the back bar plan. Take it off there.')).toBeTruthy();
  });

  test('a role that can’t place items sees the state but can’t switch it', async () => {
    mockCaps = ['menu', 'locations', 'specs'];
    mockStocked = new Set(['vida']);
    await renderWithTamagui(<IngredientsStep draft={draft} set={jest.fn()} ingredients={INGREDIENTS} bottles={venue} />);
    const bottle = screen.getByLabelText('Del Maguey Vida is on the back bar. Your role can’t change it');
    await fireEvent.press(bottle);
    expect(mockToggle).not.toHaveBeenCalled();
  });

  test('at home it puts the bottle on your shelf', async () => {
    await renderWithTamagui(<IngredientsStep draft={draft} set={jest.fn()} ingredients={INGREDIENTS} bottles={{ barId: null, venueName: '' }} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Del Maguey Vida is not on your shelf. Add it' }));
    expect(mockShelfAdd).toHaveBeenCalledWith('vida');
    expect(screen.getByText('Del Maguey Vida is on your shelf')).toBeTruthy();
  });

  test('without a place, lines have no bottle', async () => {
    await renderWithTamagui(<IngredientsStep draft={draft} set={jest.fn()} ingredients={INGREDIENTS} />);
    expect(screen.queryByLabelText(/back bar|your shelf/)).toBeNull();
  });
});
