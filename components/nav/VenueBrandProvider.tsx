import type { ReactNode } from 'react';

import { BackbarTheme, BrandProvider } from '@/components/ds';
import { useActiveVenue } from '@/hooks/useActiveVenue';

/**
 * The Back Bar theme in the active venue's colours. Wraps the redesigned tabs,
 * so every redesigned screen looks like the venue's own app.
 */
export function VenueBrandProvider({ children }: { children: ReactNode }) {
  const { active } = useActiveVenue();
  return (
    <BackbarTheme>
      <BrandProvider accent={active?.accent ?? undefined}>{children}</BrandProvider>
    </BackbarTheme>
  );
}
