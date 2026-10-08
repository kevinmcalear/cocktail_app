import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useCreatorNavStore } from '@/store/useCreatorNavStore';
import type { MenuDetail, MenuDrink } from '@/types/menus';

import { useLayoutEditor } from './useLayoutEditor';

const drink = (id: string): MenuDrink => ({ id, name: id, kind: 'cocktail', line: '', price: null, imageUrl: null, isSketch: false, glass: null });

// The library before the new drink is saved, then after (what a refetch returns).
let mockLibrary: MenuDrink[] = [drink('old')];
jest.mock('@/hooks/useMenuMutations', () => ({
  useMenuLibrary: () => ({ data: mockLibrary, refetch: async () => ({ data: mockLibrary }) }),
  useSaveMenu: () => ({ isPending: false, mutateAsync: jest.fn() }),
  usePickMenuCover: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));
jest.mock('@/hooks/useMenus', () => ({ useVenueMenus: () => ({ data: [] }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), replace: jest.fn(), canGoBack: () => true }) }));

const menu = {
  id: 'm1',
  name: 'Spring',
  barId: 'bar',
  coverUrl: null,
  coverPosition: 50,
  sections: [
    { id: 's1', name: 'Stirred', minItems: 1, maxItems: null, allowedTypes: ['cocktail'], drinks: [drink('old')] },
    { id: 's2', name: 'Shaken', minItems: 1, maxItems: null, allowedTypes: ['cocktail'], drinks: [] },
  ],
} as unknown as MenuDetail;

test('a drink made from "Create a new drink" lands in its section', async () => {
  const { result } = await renderHook(() => useLayoutEditor(menu));
  mockLibrary = [drink('new'), drink('old')];
  await act(async () => useCreatorNavStore.getState().deliverMenuDrink('s2', 'new'));
  await waitFor(() => expect(result.current.layout.sections[1].drinks.map((d) => d.id)).toEqual(['new']));
  expect(result.current.changed).toBe(true);
  expect(useCreatorNavStore.getState().pendingMenuDrink).toBeNull();
});
