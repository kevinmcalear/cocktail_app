import type { ReactNode } from 'react';

import { BackbarTheme, BrandProvider } from '@/components/ds';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useMode } from '@/hooks/useMode';

/**
 * The Back Bar theme in the active venue's colours. Wraps the redesigned tabs,
 * so every redesigned screen looks like the venue's own app: its accent,
 * display face and dark-mode ground tint. Home mode is
 * yours, not a venue's, so it keeps the app's own accent.
 */
export function VenueBrandProvider({ children }: { children: ReactNode }) {
  const { active } = useActiveVenue();
  const home = useMode().mode === 'home';
  return (
    <BackbarTheme>
      <BrandProvider
        accent={home ? undefined : (active?.accent ?? undefined)}
        displayFace={home ? undefined : active?.displayFace}
        groundTint={home ? undefined : (active?.groundTint ?? undefined)}
      >
        {children}
      </BrandProvider>
    </BackbarTheme>
  );
}
