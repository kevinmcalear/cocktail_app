import { useState } from 'react';

import { useBackBarStock } from '@/hooks/useBackBar';
import { useBarMembers } from '@/hooks/useBarDetail';
import { useBarGlassware, useHeldGlasses } from '@/hooks/useBarGlassware';
import { useBarKit } from '@/hooks/useBarKit';
import { useBarInvites } from '@/hooks/useBarInvites';
import { useVenueMenus } from '@/hooks/useMenus';
import { useVenueIce } from '@/hooks/useVenueIce';
import { groupMenus } from '@/lib/menus';
import { barSetUp, checklist, kitNote, type Checklist, type ChecklistKey } from '@/lib/setupChecklist';
import { heldNotOnPage } from '@/lib/whatNext';
import { useVenueSetup } from '@/store/useVenueSetup';

/**
 * "Set up <bar>" for a venue set up on this device (lib/setupChecklist.ts):
 * each row's state from the bar's data, a note for what's there, and Skip.
 * A venue with no setup on this device (Venue settings' Setup checklist) was
 * set up elsewhere, so Your bar counts as done. The top of Library and the
 * sidebar mount it only for a venue with a run (useSetupRun).
 */
export function useSetupChecklist(barId: string) {
  const run = useVenueSetup((s) => s.runs[barId]);
  const save = useVenueSetup((s) => s.save);
  const onPage = useBarGlassware(barId);
  const held = useHeldGlasses(barId);
  const ice = useVenueIce(barId).data?.length ?? 0;
  const tools = useBarKit(barId).data?.length ?? 0;
  const stock = useBackBarStock(barId);
  const menus = useVenueMenus(barId);
  const invites = useBarInvites(barId);
  const members = useBarMembers(barId);
  const [now] = useState(() => Date.now());
  // A menu on now, coming up or a draft: a claimed bar's past menus (its history) aren't a first menu.
  const groups = groupMenus(menus.data ?? [], now);
  const current = [...groups.on, ...groups.upcoming, ...groups.draft];
  const withDrinks = current.find((m) => m.itemIds.length > 0);
  const glasses = (onPage.data?.length ?? 0) + heldNotOnPage(held, onPage.data ?? []).length;
  const bottles = stock.data?.length ?? 0;
  const team = (invites.data?.length ?? 0) + Math.max(0, (members.data?.length ?? 1) - 1);
  const list: Checklist = checklist(
    { bar: run ? barSetUp(run) : true, kit: glasses + ice + tools > 0, bottles: bottles > 0, menu: current.length > 0, drinks: !!withDrinks, team: team > 0 },
    // Venue setup's team step passed with nobody invited counts as skipped here.
    [...(run?.skipped ?? []), ...(run?.done.includes('team') ? ['team'] : [])]
  );
  const notes: Partial<Record<ChecklistKey, string>> = {
    kit: kitNote(glasses, ice, tools),
    bottles: bottles ? `${bottles} on your shelves` : undefined,
    menu: current[0]?.name,
    drinks: withDrinks ? `${withDrinks.itemIds.length} on ${withDrinks.name}` : undefined,
    team: team ? `${team} invited` : undefined,
  };
  return {
    run,
    list,
    notes,
    /** The menu First drinks opens: the one with drinks, else the newest. */
    menuId: (withDrinks ?? current[0])?.id ?? null,
    loading: onPage.isLoading || stock.isLoading || menus.isLoading || invites.isLoading || members.isLoading,
    skip: (key: ChecklistKey) => save(barId, { skipped: [...new Set([...(run?.skipped ?? []), key])] }),
  };
}

/** The venue's setup run on this device, if it has one: whether "Set up <bar>" can show. */
export const useSetupRun = (barId: string | null | undefined) => useVenueSetup((s) => (barId ? s.runs[barId] : undefined));
