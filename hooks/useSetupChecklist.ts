import { useState } from 'react';

import { useBarMembers } from '@/hooks/useBarDetail';
import { useBarGlassware, useHeldGlasses } from '@/hooks/useBarGlassware';
import { useBarInvites } from '@/hooks/useBarInvites';
import { useVenueMenus } from '@/hooks/useMenus';
import { useBarPublishing } from '@/hooks/usePublishing';
import { useVenueBrand } from '@/hooks/useVenueBrand';
import { useVenueClaim, useVenuePage } from '@/hooks/useVenueSetup';
import { useCalendarSources } from '@/hooks/useWeek';
import { groupMenus } from '@/lib/menus';
import { PAGE_COPY } from '@/lib/pageVisibility';
import { checklist, lookSet, menuLine, placeSet, type Checklist, type ChecklistKey } from '@/lib/setupChecklist';
import { heldNotOnPage } from '@/lib/whatNext';
import { useVenueSetup } from '@/store/useVenueSetup';

/**
 * "Set up <bar>" (lib/setupChecklist.ts): each row's state from the bar's
 * data, the line under it, and Skip. A venue with no setup on this device
 * (Venue settings' Setup checklist) was set up elsewhere, so Where and when
 * counts as done. The top of Library and the sidebar mount it only for a
 * venue with a run (useSetupRun).
 */
export function useSetupChecklist(barId: string) {
  const run = useVenueSetup((s) => s.runs[barId]);
  const save = useVenueSetup((s) => s.save);
  const claim = useVenueClaim(barId);
  const page = useVenuePage(barId);
  const menus = useVenueMenus(barId);
  const onPage = useBarGlassware(barId);
  const held = useHeldGlasses(barId);
  const invites = useBarInvites(barId);
  const members = useBarMembers(barId);
  const publishing = useBarPublishing(barId);
  const brand = useVenueBrand(barId);
  const calendars = useCalendarSources(barId);
  const [now] = useState(() => Date.now());

  // Tonight's menu: one on now with drinks. Else the one being made (coming up or a draft) is where the row goes.
  const groups = groupMenus((menus.data ?? []).filter((m) => m.barId === barId), now);
  const tonight = groups.on.find((m) => m.itemIds.length > 0) ?? null;
  const making = tonight ?? [...groups.on, ...groups.upcoming, ...groups.draft][0] ?? null;
  const claimed = !!page.data || claim.data?.status === 'approved' || claim.data?.status === 'pending';
  const glasses = (onPage.data?.length ?? 0) + heldNotOnPage(held, onPage.data ?? []).length;
  const team = (invites.data?.length ?? 0) + Math.max(0, (members.data?.length ?? 1) - 1);
  const visibility = publishing.data?.pageVisibility ?? 'description';
  // A brand that won't load steps aside, as Your team's gate does.
  const looks = brand.data ? lookSet(brand.data, run) : !!brand.error;

  const done: Record<ChecklistKey, boolean> = {
    claim: claimed,
    menu: !!tonight,
    where: placeSet(run),
    glassware: glasses > 0,
    team: team > 0,
    visibility: !!run?.done.includes('visibility') || !!publishing.data?.pageChangedAt,
    // Not when the brand failed to load: that only opens Your team.
    theme: !!brand.data && looks,
    calendars: (calendars.data?.length ?? 0) > 0,
  };
  // A run from before 26 Oct that passed venue setup's old team step with nobody invited: still skipped, so a finished checklist stays finished.
  const list: Checklist = checklist(done, [...(run?.skipped ?? []), ...((run?.done as readonly string[] | undefined)?.includes('team') ? ['team'] : [])]);
  // The line under each row: the drawn one, or what's there now.
  const lines: Partial<Record<ChecklistKey, string | null>> = {
    claim: claim.data?.status === 'pending' && !page.data ? 'We’re checking it’s yours' : done.claim ? null : undefined,
    menu: making ? menuLine(making.name, making.itemIds.length) : undefined,
    where: done.where ? null : undefined,
    visibility: done.visibility ? PAGE_COPY[visibility].label : `${PAGE_COPY[visibility].label}, for now`,
  };
  return {
    run,
    list,
    /** Null: no line under a done row. Undefined: the row's own line. */
    lines,
    /** Tonight's menu, or the one being made: the row opens its editor. */
    menuId: making?.id ?? null,
    /** The look is set: Your team goes straight to the invites. */
    looks,
    loading: claim.isLoading || page.isLoading || menus.isLoading || onPage.isLoading || invites.isLoading || members.isLoading || publishing.isLoading || brand.isLoading || calendars.isLoading,
    skip: (key: ChecklistKey) => save(barId, { skipped: [...new Set([...(run?.skipped ?? []), key])] }),
  };
}

/** The venue's setup run on this device, if it has one: whether "Set up <bar>" can show. */
export const useSetupRun = (barId: string | null | undefined) => useVenueSetup((s) => (barId ? s.runs[barId] : undefined));
