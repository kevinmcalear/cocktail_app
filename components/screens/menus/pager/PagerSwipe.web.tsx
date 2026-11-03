import type { ReactNode } from 'react';

/** The web pages with the arrow keys and the pager bar, so no gesture code comes with a drink page. */
export function PagerSwipe({ children }: { menuId: string; bar: string | null; itemId: string; children: ReactNode }) {
  return <>{children}</>;
}
