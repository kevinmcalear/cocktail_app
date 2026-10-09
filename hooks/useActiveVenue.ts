import { useMemo } from 'react';

import { useBars } from '@/hooks/useBars';
import { useAuthIdentity } from '@/ctx/AuthContext';
import type { DisplayFace } from '@/constants/tokens';
import { faceFromDb, usableGroundTint } from '@/lib/brand';
import { isHexColor } from '@/lib/color';
import { useAppMode, useAppModeHydrated } from '@/store/useAppMode';

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
 * The venue the person is working in, and the venues they can switch to. The
 * pick is saved on the device (useAppMode), so a reload comes back to it.
 * In home mode this is still the venue going back would land on: home
 * screens check useMode() before using it.
 */
export function useActiveVenue() {
  const { data, isError } = useBars();
  // Not known until a signed-in person's bars arrive. A disabled or cache-restoring
  // query reports isLoading false, which briefly put venue staff in home mode.
  // While auth settles, `user` can already be the saved session's user, whose
  // cached bars count as known; with no user yet, nothing is.
  const { loading: authLoading, userId } = useAuthIdentity();
  // The saved pick isn't known until storage is read, so nothing is active
  // before then: the first venue would flash up, and fetch, in its place.
  const hydrated = useAppModeHydrated();
  const isLoading = !hydrated || (userId ? data === undefined && !isError : authLoading);
  const venueId = useAppMode((s) => s.venueId);
  const enterVenue = useAppMode((s) => s.enterVenue);

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

  // Nothing picked yet, or the picked venue is gone (left the team, another
  // person signed in): the first venue, until one is chosen.
  const active = hydrated ? (venues.find((v) => v.id === venueId) ?? venues[0] ?? null) : null;
  return { venues, active, enterVenue, isLoading };
}
