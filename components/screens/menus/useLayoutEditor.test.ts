import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useMenuDrinkHandoff } from '@/store/useMenuDrinkHandoff';
import { savePayload, type MenuLayout } from '@/lib/menuLayout';
import type { MenuDetail, MenuDrink } from '@/types/menus';

import { saveStatus } from './EditorParts';
import { useLayoutEditor } from './useLayoutEditor';

const drink = (id: string): MenuDrink => ({ id, name: id, kind: 'cocktail', line: '', price: null, imageUrl: null, isSketch: false, glass: null });

// The library before the new drink is saved, then after (what a refetch returns).
let mockLibrary: MenuDrink[] = [drink('old')];
const mockSaveMenu = jest.fn(async (_layout: MenuLayout) => {});
const mockPickCover = jest.fn(async (): Promise<string | null> => null);
jest.mock('@/hooks/useMenuMutations', () => ({
  useMenuLibrary: () => ({ data: mockLibrary, refetch: async () => ({ data: mockLibrary }) }),
  useSaveMenu: () => ({ isPending: false, mutateAsync: mockSaveMenu }),
  usePickMenuCover: () => ({ isPending: false, mutateAsync: mockPickCover }),
}));
jest.mock('@/hooks/useMenus', () => ({ useVenueMenus: () => ({ data: [] }) }));
const mockSavePrices = jest.fn(async (_prices: Record<string, string | null>) => {});
jest.mock('@/hooks/useDrinkCost', () => ({ useSetDrinkPrices: () => ({ isPending: false, mutateAsync: mockSavePrices }) }));
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
  await act(async () => useMenuDrinkHandoff.getState().deliver('s2', 'new'));
  await waitFor(() => expect(result.current.layout.sections[1].drinks.map((d) => d.id)).toEqual(['new']));
  expect(result.current.changed).toBe(true);
  expect(useMenuDrinkHandoff.getState().pending).toBeNull();
});

test('a price changed in the builder is the drink\'s own: saved with the menu, then cleared', async () => {
  const { result } = await renderHook(() => useLayoutEditor(menu));
  await act(async () => result.current.setPrice('old', ' 19.50 '));
  expect(result.current.layout.sections[0].drinks[0].price).toBe('19.50');
  expect(result.current.changed).toBe(true);
  await act(async () => {
    await result.current.persist();
  });
  expect(mockSavePrices).toHaveBeenCalledWith({ old: '19.50' });
  expect(result.current.changed).toBe(false);
  expect(result.current.layout.prices).toEqual({});
});

test("the phone's Done sets the drink's price and this menu's at once; this menu's saves with the menu", async () => {
  mockSavePrices.mockClear();
  const { result } = await renderHook(() => useLayoutEditor(menu));
  await act(async () => {
    result.current.setPrice('old', '19');
    result.current.setMenuPrice('old', ' 22 ');
  });
  const row = result.current.layout.sections[0].drinks[0];
  expect([row.price, row.menuPrice]).toEqual(['19', '22']);
  await act(async () => {
    await result.current.persist();
  });
  expect(savePayload(mockSaveMenu.mock.calls.at(-1)![0])[0].prices).toEqual(['22']);
  expect(mockSavePrices).toHaveBeenCalledWith({ old: '19' });
  expect(result.current.changed).toBe(false);
});

test('a cover that fails to upload says so on the cover and keeps the rest saving', async () => {
  mockPickCover.mockRejectedValueOnce(new Error('Network request failed'));
  const { result } = await renderHook(() => useLayoutEditor(menu));
  await act(async () => result.current.rename('Spring 2'));
  await act(async () => {
    await result.current.pickCover();
  });
  expect(result.current.coverError).toBe('The cover didn’t upload. Try again.');
  expect(result.current.error).toBeNull();
  expect(saveStatus(result.current).text).toBe('Saving…');
  mockPickCover.mockResolvedValueOnce('https://example.test/cover.jpg');
  await act(async () => {
    await result.current.pickCover();
  });
  expect(result.current.coverError).toBeNull();
  expect([result.current.layout.name, result.current.layout.coverUrl]).toEqual(['Spring 2', 'https://example.test/cover.jpg']);
});
