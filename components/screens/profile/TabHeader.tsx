import type { ComponentProps, ReactNode } from 'react';

import { ScreenHeader } from '@/components/nav/ScreenHeader';

/** The tab's header for You (TabHeader.web.tsx loads it in its own chunk). */
export function TabHeader({ fallback: _fallback, ...props }: ComponentProps<typeof ScreenHeader> & { fallback: ReactNode }) {
  return <ScreenHeader {...props} />;
}
