import { fireEvent, waitFor } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { GlassWhich, type GlassWhichValue } from './GlassWhich';

// The catalog's pick button, pressed by hand: picks the Savage Pony, which the catalog files as a Nick & Nora.
const pony = { id: 'm1', name: 'Savage Pony', glass: 'nick', variant: 'nick_little' };
let mockPick: ((m: object) => void) | null = null;
jest.mock('@/components/glass/GlassModelPicker', () => ({
  GlassModelPicker: ({ onPick }: { onPick: (m: object) => void }) => {
    mockPick = onPick;
    return null;
  },
}));
jest.mock('@/components/glass/GlassSnap', () => ({ GlassSnap: () => null }));
jest.mock('@/components/glass/GlassModelCard', () => ({ GlassModelCard: () => null }));

beforeEach(() => {
  mockPick = null;
});

const find: GlassWhichValue = { mode: 'find', model: null, glass: 'coupe', variant: 'coupe_deep', name: 'Pony' };

test("a real glass picked for the venue's Coupe keeps it a Coupe", async () => {
  const onChange = jest.fn();
  renderWithTamagui(<GlassWhich value={find} onChange={onChange} keepShape />);
  await waitFor(() => expect(mockPick).toBeTruthy());
  mockPick!(pony);
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ mode: 'picked', glass: 'coupe', variant: 'coupe_deep', name: 'Pony' }));
});

test('a new glass takes the type the catalog files it under', async () => {
  const onChange = jest.fn();
  renderWithTamagui(<GlassWhich value={find} onChange={onChange} />);
  await waitFor(() => expect(mockPick).toBeTruthy());
  mockPick!(pony);
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ mode: 'picked', glass: 'nick', variant: 'nick_little' }));
});

test('a glass kept as the Coupe can still be filed under its own type', async () => {
  const onChange = jest.fn();
  const model = { ...pony, maker: null } as unknown as GlassWhichValue['model'];
  const { getByRole } = await renderWithTamagui(<GlassWhich value={{ ...find, mode: 'picked', model }} onChange={onChange} keepShape />);
  fireEvent.press(getByRole('button', { name: 'Use it as a Nick & Nora' }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ glass: 'nick', variant: 'nick_little' }));
});
