import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { GlassModel } from '@/hooks/useGlassModels';

import { GlassSnap } from './GlassSnap';

// The camera and the AI read are mocked: no paid call runs in a test.
const mockTake = jest.fn();
const mockSuggest = jest.fn();
jest.mock('@/lib/identifyGlassware', () => ({
  takeGlassPhoto: () => mockTake(),
  suggestGlassModels: (photo: unknown) => mockSuggest(photo),
}));

const model = (id: string, name: string, capacity_ml: number): GlassModel => ({
  id, name, capacity_ml, maker_profile_id: 'm', maker: { handle: 'urban.bar', display_name: 'Urban Bar' }, shape_item_id: null,
  glass: 'nick', variant: null, series: 'Leopold', designer: null, model_code: null, height_mm: null, rim_mm: null, material: 'glass', product_url: null,
});

const snap = (onPick: (m: GlassModel) => void) =>
  renderWithTamagui(
    <QueryClientProvider client={new QueryClient()}>
      <GlassSnap onPick={onPick} />
    </QueryClientProvider>
  );

beforeEach(() => {
  mockTake.mockReset().mockResolvedValue({ uri: 'file:///glass.jpg', mimeType: 'image/jpeg' });
  mockSuggest.mockReset();
});

test('a photo suggests the closest glasses, and one is picked', async () => {
  const leopold = model('a', 'Leopold Nick & Nora', 150);
  mockSuggest.mockResolvedValue({ glass: 'nick', makerMark: null, capacityMl: 150, confidence: 0.8, models: [leopold, model('b', 'Retro Nick & Nora', 160)] });
  const onPick = jest.fn();
  await snap(onPick);

  await fireEvent.press(screen.getByRole('button', { name: 'Snap the glass' }));
  await waitFor(() => expect(screen.getByText('Looks like: Nick & Nora, about 150 ml')).toBeTruthy());
  expect(mockSuggest).toHaveBeenCalledWith({ uri: 'file:///glass.jpg', mimeType: 'image/jpeg' });

  await fireEvent.press(screen.getByText('Leopold Nick & Nora'));
  expect(onPick).toHaveBeenCalledWith(leopold);
});

test('no match says so; a cancelled photo reads nothing; an error shows its words', async () => {
  mockSuggest.mockResolvedValue({ glass: 'tiki', makerMark: 'Munktiki', capacityMl: null, confidence: 0.4, models: [] });
  await snap(jest.fn());
  await fireEvent.press(screen.getByRole('button', { name: 'Snap the glass' }));
  await waitFor(() => expect(screen.getByText('No maker lists a glass like that (Tiki mug, marked “Munktiki”) yet. Search for it below.')).toBeTruthy());

  mockTake.mockResolvedValueOnce(null);
  await fireEvent.press(screen.getByRole('button', { name: 'Snap it again' }));
  expect(mockSuggest).toHaveBeenCalledTimes(1);

  mockSuggest.mockRejectedValueOnce(new Error('You’ve reached today’s AI limit. Try again tomorrow.'));
  await fireEvent.press(screen.getByRole('button', { name: 'Snap it again' }));
  await waitFor(() => expect(screen.getByText('You’ve reached today’s AI limit. Try again tomorrow.')).toBeTruthy());
});
