import { useState } from 'react';

import { menuPageNow } from '@/lib/menus';

/**
 * The moment a screen reads its menus' dates against: when it opened, or the
 * fetch that brought the menus back when that is later. "Put it on now"
 * starts a menu at the server's clock, after the screen opened; the refetch
 * that follows moves this on, so the menu reads On now and the one it
 * replaced moves to Previous. Every menuStatus / groupMenus on a screen goes
 * through here (hooks/useMenuNow.check.ts), never a `useState(() => Date.now())`.
 *
 * Pass the menus query's `dataUpdatedAt`; leave it out where there's no query.
 */
export function useMenuNow(fetchedAt: number = 0): number {
  const [openedAt] = useState(() => Date.now());
  return menuPageNow(openedAt, fetchedAt);
}
