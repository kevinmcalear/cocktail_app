import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { GlassesStep } from './GlassesStep';

const [mockSave, mockRemove, mockHold, mockDrop] = [jest.fn(), jest.fn(), jest.fn(), jest.fn()];
let mockGlasses: object[] = [];
let mockHeld: object[] = [];

jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ refetchQueries: () => Promise.resolve() }) }));
jest.mock('@/hooks/useBarGlassware', () => ({
  useBarGlassware: () => ({ data: mockGlasses }),
  useHeldGlasses: () => mockHeld,
  useSaveBarGlass: () => ({ mutateAsync: mockSave, mutate: mockSave }),
  useDeleteBarGlass: () => ({ mutateAsync: mockRemove }),
}));
jest.mock('@/store/useVenueSetup', () => ({ useVenueSetup: (pick: (s: object) => unknown) => pick({ holdGlass: mockHold, dropGlass: mockDrop }) }));
jest.mock('@/hooks/useIsWideWeb', () => ({ useIsWideWeb: () => false }));
jest.mock('@/components/glass/GlassModelPicker', () => ({ GlassThumb: () => null, GlassModelPicker: () => null }));
jest.mock('@/components/screens/kit/GlassSheet', () => ({ GlassSheet: () => null }));

const coupe = { id: 'g1', glass: 'coupe', variant: null, name: null, model_id: null, model: null, is_default: true };

beforeEach(() => {
  mockGlasses = [];
  mockHeld = [];
  for (const m of [mockSave, mockRemove, mockHold, mockDrop]) m.mockReset();
  mockSave.mockResolvedValue(undefined);
  mockRemove.mockResolvedValue(undefined);
});

test('tapping a kind saves it on its own: no model, no count, the main one', async () => {
  await renderWithTamagui(<GlassesStep barId="b1" pageId="p1" name="Little Rye" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Coupe' }));
  await waitFor(() => expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ glass: 'coupe', variant: null, name: null, model_id: null, is_default: true })));
  expect(mockSave.mock.calls[0][0]).not.toHaveProperty('count');
});

test('a kind on the list shows as "Any coupe" with Add the model, and tapping it again takes it off', async () => {
  mockGlasses = [coupe];
  await renderWithTamagui(<GlassesStep barId="b1" pageId="p1" name="Little Rye" />);
  expect(screen.getByText('Added · 1')).toBeTruthy();
  expect(screen.getByText('Any coupe')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Add the model for Coupe' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Coupe' }));
  await waitFor(() => expect(mockRemove).toHaveBeenCalledWith('g1'));
});

test('a real glass of that kind stays when its tile is tapped', async () => {
  mockGlasses = [{ ...coupe, model_id: 'm1', model: { name: 'Retro Coupette', maker: { display_name: 'Urban Bar' } } }];
  await renderWithTamagui(<GlassesStep barId="b1" pageId="p1" name="Little Rye" />);
  expect(screen.getByText('Urban Bar Retro Coupette')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Coupe' }));
  expect(mockRemove).not.toHaveBeenCalled();
  expect(mockSave).not.toHaveBeenCalled();
});

test('before the page is checked, a kind is held on the device', async () => {
  await renderWithTamagui(<GlassesStep barId="b1" pageId={null} name="Little Rye" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Double rocks' }));
  expect(mockHold).toHaveBeenCalledWith('b1', expect.objectContaining({ key: 'kind-rocks_double', glass: 'rocks', variant: 'rocks_double', name: 'Double rocks', model_id: null }));
  expect(mockSave).not.toHaveBeenCalled();
});
