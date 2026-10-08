import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useBarEditor } from '@/hooks/useBarEditor';

const mockRpc = jest.fn(async (..._args: unknown[]) => ({ error: null }));
const bar = {
  id: 'b1',
  name: 'Little Rye',
  slug: 'little-rye',
  logo_url: 'https://x/logo.png',
  primary_color: '#D0643B',
  secondary_color: '#F4E6D0',
  default_visibility_level: 10,
  default_generic_ingredient_level: 20,
  default_specific_brand_level: 30,
  default_measurement_level: 30,
  default_prep_level: 40,
};

jest.mock('@/hooks/useBarDetail', () => ({ useBarDetail: () => ({ data: { bar, members: [], items: [] }, isLoading: false }) }));
jest.mock('@/hooks/useBars', () => ({ useBars: () => ({ data: [{ bar_id: 'b1', role_level: 40 }] }) }));
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => mockRpc(...args) } }));

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

test('edits stay a draft until saved, Discard drops them, and a save keeps the Brand screen’s logo and colours', async () => {
  const { result } = await renderHook(() => useBarEditor('b1'), { wrapper });
  expect(result.current).toMatchObject({ loading: false, isDirty: false, name: 'Little Rye', specificLevel: '30' });

  await act(() => result.current.setName('Little Rye Bar'));
  expect(result.current.isDirty).toBe(true);
  await act(() => result.current.discardChanges());
  expect(result.current).toMatchObject({ isDirty: false, name: 'Little Rye' });

  // Changing a value back to what's saved isn't a change.
  await act(() => result.current.setSpecificLevel('35'));
  await act(() => result.current.setSpecificLevel('30'));
  expect(result.current.isDirty).toBe(false);

  await act(() => result.current.setSpecificLevel('35'));
  let saved = false;
  await act(async () => {
    saved = await result.current.handleSave();
  });
  expect(saved).toBe(true);
  expect(mockRpc).toHaveBeenCalledWith('update_bar_settings', {
    p_bar_id: 'b1',
    p_name: 'Little Rye',
    p_visibility: 10,
    p_generic: 20,
    p_specific: 35,
    p_measurement: 30,
    p_prep: 40,
    p_logo_url: 'https://x/logo.png',
    p_primary_color: '#D0643B',
    p_secondary_color: '#F4E6D0',
  });
});
