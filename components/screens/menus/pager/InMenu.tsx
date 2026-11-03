import { useLocalSearchParams } from 'expo-router';
import { lazy, Suspense, type ReactNode } from 'react';

// The pager comes in its own chunk, only when a drink page is opened from a menu, so no drink page's first load carries it.
const MenuPager = lazy(() => import('./MenuPager').then((m) => ({ default: m.MenuPager })));

/**
 * A drink page opened from a menu (?menu=, and ?bar= for a guest) is read
 * inside it: "Autumn · 4 of 8" and the glass pager (Menu-pager). Anywhere
 * else the drink page is just the drink page.
 */
export function InMenu({ itemId, children }: { itemId: string | undefined; children: ReactNode }) {
  const { menu, bar } = useLocalSearchParams<{ menu?: string; bar?: string }>();
  if (!menu || !itemId) return <>{children}</>;
  return (
    <Suspense fallback={children}>
      <MenuPager menuId={menu} bar={bar ?? null} itemId={itemId}>
        {children}
      </MenuPager>
    </Suspense>
  );
}
