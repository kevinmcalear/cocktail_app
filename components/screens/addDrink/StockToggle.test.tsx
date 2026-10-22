import { fireEvent, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { renderWithTamagui } from '@/jest.setup';
import { newLine, type WizardLine } from '@/lib/drinkWizard';

import { useLineStock } from './StockToggle';

const mockAdd = jest.fn();
const mockRemove = jest.fn();
const mockShelfAdd = jest.fn();
let mockCaps: string[] = ['edit_drinks'];
let mockFixed = new Map<string, string>();
let mockStocked = new Map<string, { item_id: string; source: string; from_name: string | null; added_at: string }>();

jest.mock('@/hooks/useBackBar', () => ({
  useBackBarParts: () => ({ fixed: mockFixed, stocked: mockStocked, ids: new Set([...mockFixed.keys(), ...mockStocked.keys()]) }),
  useStockMutations: () => ({ add: { mutate: mockAdd }, remove: { mutate: mockRemove } }),
}));
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ data: mockCaps }) }));
jest.mock('@/hooks/useHomeBar', () => ({
  useShelf: () => ({ data: [] }),
  useShelfEdit: () => ({ add: { mutate: mockShelfAdd }, remove: { mutate: jest.fn() } }),
}));

const CATALOG = [
  { id: 'vida', name: 'Del Maguey Vida', ingredient_role: 'product', generic_id: 'mezcal' },
  { id: 'mezcal', name: 'Mezcal', ingredient_role: 'generic' },
  { id: 'agave', name: 'Agave syrup', ingredient_role: 'generic' },
  { id: 'lime', name: 'Lime juice', ingredient_role: 'generic' },
  { id: 'campari', name: 'Campari', ingredient_role: 'product' },
];
const line = (id: string, name: string): WizardLine => newLine({ id, name }, 'ml', '30');
const LINES = [line('vida', 'Del Maguey Vida'), line('agave', 'Agave syrup'), line('lime', 'Lime juice'), line('campari', 'Campari')];

function Lines({ barId = 'little-rye' }: { barId?: string | null }) {
  const stock = useLineStock({ barId, venueName: 'Little Rye', drinkName: 'Ash Garden', ingredients: CATALOG, lines: LINES });
  return (
    <View>
      {LINES.map((l) => (
        <View key={l.key}>{stock.toggle(l)}</View>
      ))}
      {stock.footer}
    </View>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCaps = ['edit_drinks'];
  mockFixed = new Map([['campari', 'pour']]);
  mockStocked = new Map();
});

describe('the bottle on the line', () => {
  test('bottles get it, juice does not; one tap puts it on the back bar with a note and Undo', async () => {
    await renderWithTamagui(<Lines />);
    expect(screen.queryByLabelText(/Lime juice/)).toBeNull();
    expect(screen.getByText('The bottle on the right: lit when it’s on your back bar. Tap to change.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Del Maguey Vida is not on the back bar. Add it' }));
    expect(mockAdd).toHaveBeenCalledWith({ item: { id: 'vida', name: 'Del Maguey Vida' }, source: 'drink', fromName: 'Ash Garden' });
    expect(screen.getByText('Del Maguey Vida is on Little Rye’s back bar')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Undo: Del Maguey Vida is on Little Rye’s back bar' }));
    expect(mockRemove).toHaveBeenCalledWith('vida');
  });

  test('switched off, Undo puts its row back as it was, not as added from this drink', async () => {
    mockStocked = new Map([['vida', { item_id: 'vida', source: 'setup', from_name: null, added_at: '2026-10-01T12:00:00.000Z' }]]);
    await renderWithTamagui(<Lines />);
    await fireEvent.press(screen.getByRole('button', { name: 'Del Maguey Vida is on Little Rye’s back bar' }));
    expect(mockRemove).toHaveBeenCalledWith('vida');
    await fireEvent.press(screen.getByRole('button', { name: 'Undo: Del Maguey Vida is off Little Rye’s back bar' }));
    expect(mockAdd).toHaveBeenCalledWith({ item: { id: 'vida', name: 'Del Maguey Vida' }, source: 'setup', fromName: null, addedAt: '2026-10-01T12:00:00.000Z' });
  });

  test('a bottle another drink pours stays on, and the tap says why', async () => {
    await renderWithTamagui(<Lines />);
    await fireEvent.press(screen.getByRole('button', { name: 'Campari is on Little Rye’s back bar' }));
    expect(mockRemove).not.toHaveBeenCalled();
    expect(screen.getByText('Another drink at Little Rye pours Campari, so it stays on the back bar')).toBeTruthy();
  });

  test('a role that cannot place items sees the state, and it does not switch', async () => {
    mockCaps = ['menu'];
    await renderWithTamagui(<Lines />);
    const button = screen.getByLabelText('Agave syrup is not on the back bar. Your role can’t change it');
    await fireEvent.press(button);
    expect(mockAdd).not.toHaveBeenCalled();
    expect(screen.getByText('The bottle on the right: lit when it’s on your back bar.')).toBeTruthy();
  });

  test('at home it means your shelf', async () => {
    await renderWithTamagui(<Lines barId={null} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Agave syrup is not on your shelf. Add it' }));
    expect(mockShelfAdd).toHaveBeenCalledWith('agave');
    expect(screen.getByText('Agave syrup is on your shelf')).toBeTruthy();
  });
});
