import { useLocalSearchParams } from 'expo-router';
import { lazy, Suspense, type ReactNode } from 'react';

const MenuPager = lazy(() => import('./MenuPager').then((m) => ({ default: m.MenuPager })));

/**
 * The web's drink page opened from a menu (InMenu.tsx): no swipe here (the
 * arrow keys and the pager bar page it), so the page is left as it is and
 * the pager is laid over it, in its own chunk, only from a menu. That keeps
 * every public drink page's first load (B13 /d/[id]) free of it.
 */
export function InMenu({ itemId, children }: { itemId: string | undefined; children: ReactNode }) {
  const { menu, bar } = useLocalSearchParams<{ menu?: string; bar?: string }>();
  return (
    <>
      {children}
      {menu && itemId ? (
        <Suspense fallback={null}>
          <MenuPager menuId={menu} bar={bar ?? null} itemId={itemId} />
        </Suspense>
      ) : null}
    </>
  );
}
