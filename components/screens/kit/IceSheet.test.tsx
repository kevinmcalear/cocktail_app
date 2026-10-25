import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { IceSheet } from './IceSheet';

// The drawings and the database aren't under test: what the sheet saves is.
jest.mock('@/components/ds/IceThumb', () => ({ IceThumb: () => null }));
const mockSave = jest.fn();
jest.mock('@/hooks/useVenueIce', () => ({ useSaveVenueIce: () => ({ mutate: mockSave, isPending: false, error: null }) }));
jest.mock('@/hooks/useVenueSuppliers', () => ({
  useVenueSuppliers: () => ({ data: [{ id: 'cold', name: 'Coldwater Ice Co.', cuts_to_order: true }] }),
}));

beforeEach(() => mockSave.mockReset());

test('Add ice: a clear 50 mm large cube, bought from a supplier, is saved with the name the sheet gives it', async () => {
  await renderWithTamagui(<IceSheet barId="bar" visible onClose={() => {}} />);
  await fireEvent.press(screen.getByRole('radio', { name: 'Large cube' }));
  await fireEvent.press(screen.getByRole('radio', { name: '50 mm' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Clear' }));
  expect(screen.getByText('We’ll call it Clear cube · 50 mm.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  // Bought says which suppliers cut to order.
  await fireEvent.press(screen.getByRole('radio', { name: /^Bought\. .*Coldwater Ice Co\. cuts to order\./ }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Coldwater Ice Co.' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Add ice' }));
  expect(mockSave.mock.calls[0][0]).toEqual({
    id: undefined,
    name: 'Clear cube · 50 mm',
    shape: 'large',
    draw_as: null,
    size_mm: 50,
    length_mm: null,
    clear: true,
    stamped: false,
    frozen_inside: null,
    source: 'bought',
    supplier_id: 'cold',
    machine: null,
    note: null,
  });
});

test('Changing an ice keeps the bar’s own name and opens where it comes from; Skip leaves that as it was', async () => {
  const ice = {
    id: 'prism', name: 'Prism cube', shape: 'other' as const, draw_as: 'large', size_mm: 45, length_mm: null, clear: true, stamped: false,
    frozen_inside: 'A glass prism', source: 'made', supplier_id: null, supplier_name: null, machine: null, note: null,
  };
  await renderWithTamagui(<IceSheet barId="bar" visible ice={ice} startAt={1} onClose={() => {}} />);
  expect(screen.getByRole('radio', { name: /^We make it/, checked: true })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
  expect(mockSave.mock.calls[0][0]).toMatchObject({ id: 'prism', name: 'Prism cube', shape: 'other', draw_as: 'large', frozen_inside: 'A glass prism', source: 'made' });
});
