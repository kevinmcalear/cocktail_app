import type { ReactNode } from 'react';

/** The web pages with the arrow keys and the pager bar, so no gesture code comes with the pager. */
export function PagerSwipe({ children }: { enabled: boolean; onNext: () => void; onPrev: () => void; children: ReactNode }) {
  return <>{children}</>;
}
