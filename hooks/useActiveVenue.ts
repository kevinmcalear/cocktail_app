import { useMemo } from 'react';

import { useBars } from '@/hooks/useBars';
import { useAuth } from '@/ctx/AuthContext';
import type { DisplayFace } from '@/constants/tokens';
import { faceFromDb, usableGroundTint } from '@/lib/brand';
import { isHexColor } from '@/lib/color';
import { useAppStore } from '@/store/useAppStore';

export interface Venue {
  id: string;
  name: string;
  logoUrl: string | null;
  /** The venue's primary colour, if it's a valid hex; otherwise null. */
  accent: string | null;
  displayFace: DisplayFace;
  /** The dark-mode ground tint, only when text still reads on it. */
  groundTint: string | null;
  roleLevel: number;
}

/**
 * The venue the person is working in, and the venues they can switch to.
 * Uses the app's existing venue context (useAppStore.selectedBarId), so
 * switching here also scopes search and editing to that venue.
 */
export function useActiveVenue() {
  const { data, isError } = useBars();
  // Not known until a signed-in person's bars arrive. A disabled or cache-restoring
  // query reports isLoading false, which briefly put venue staff in home mode.
  // While auth settles, `user` can already be the saved session's user, whose
  // cached bars count as known; with no user yet, nothing is.
  const { loading: authLoading, user } = useAuth();
  const isLoading = user ? data === undefined && !isError : authLoading;
  const selectedBarId = useAppStore((s) => s.selectedBarId);
  const setActive = useAppStore((s) => s.setSelectedBarId);

  const venues = useMemo<Venue[]>(() => {
    const out: Venue[] = [];
    for (const row of data ?? []) {
      const bar = Array.isArray(row.bars) ? row.bars[0] : row.bars;
      if (!bar) continue;
      out.push({
        id: bar.id,
        name: bar.name,
        logoUrl: bar.logo_url,
        accent: isHexColor(bar.primary_color) ? bar.primary_color : null,
        displayFace: faceFromDb(bar.display_face),
        groundTint: usableGroundTint(bar.ground_tint),
        roleLevel: row.role_level ?? 0,
      });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  // ponytail: with no venue chosen yet (search context "personal"), show the
  // first venue rather than an empty state. Choosing one sets the context.
  const active = venues.find((v) => v.id === selectedBarId) ?? venues[0] ?? null;
  return { venues, active, setActive, isLoading };
}
