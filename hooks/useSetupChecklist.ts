
import { useMenuNow } from '@/hooks/useMenuNow';
import { useBarMembers } from '@/hooks/useBarDetail';
import { useBarGlassware, useHeldGlasses } from '@/hooks/useBarGlassware';
import { useBarKit } from '@/hooks/useBarKit';
import { useBarInvites } from '@/hooks/useBarInvites';
import { useVenueMenus } from '@/hooks/useMenus';
import { useVenueBrand } from '@/hooks/useVenueBrandRow';
import { useVenueIce } from '@/hooks/useVenueIce';
import { useVenueClaim, useVenuePage } from '@/hooks/useVenueSetup';
import { useCalendarSources } from '@/hooks/useCalendarSources';
import { groupMenus } from '@/lib/menus';
import { checklist, kitNote, lookSet, menuNote, setupStepDone, type Checklist, type ChecklistKey } from '@/lib/setupChecklist';
import { heldNotOnPage } from '@/lib/whatNext';
import { useVenueSetup } from '@/store/useVenueSetup';

/**
 * "Set up <bar>" (lib/setupChecklist.ts): each row's state from the bar's
 * data, a note for what's there, and Skip. Venue setup's own steps (Where and
 * when, Who sees your page) count as done for a venue set up on another
 * device. The top of Drinks and the sidebar mount it only for a venue with a
 * run on this device (useSetupRun).
 */
export function useSetupChecklist(barId: string) {
  const run = useVenueSetup((s) => s.runs[barId]);
  const save = useVenueSetup((s) => s.save);
  const onPage = useBarGlassware(barId);
  const held = useHeldGlasses(barId);
  const iceList = useVenueIce(barId);
  const toolList = useBarKit(barId);
  const menus = useVenueMenus(barId);
  const invites = useBarInvites(barId);
  const members = useBarMembers(barId);
  const claim = useVenueClaim(barId);
  const page = useVenuePage(barId);
  const brand = useVenueBrand(barId);
  const calendars = useCalendarSources(barId);
  const now = useMenuNow(menus.dataUpdatedAt);
  // A menu on now, coming up or a draft: a claimed bar's past menus (its history) aren't tonight's.
  const groups = groupMenus(menus.data ?? [], now);
  const current = [...groups.on, ...groups.upcoming, ...groups.draft];
  const ice = iceList.data?.length ?? 0;
  const tools = toolList.data?.length ?? 0;
  const glasses = (onPage.data?.length ?? 0) + heldNotOnPage(held, onPage.data ?? []).length;
  const team = (invites.data?.length ?? 0) + Math.max(0, (members.data?.length ?? 1) - 1);
  const status = claim.data?.status;
  // Sent counts: they can keep going while we check (board Prod-first-owner, step 2).
  const claimed = !!page.data || status === 'approved' || status === 'pending';
  // If the brand fails to load, Theme and the team's look gate step aside rather than block.
  const looks = brand.data ? lookSet(brand.data, run) : !!brand.error;
  const list: Checklist = checklist(
    {
      claim: claimed,
      menu: current.length > 0,
      place: setupStepDone(run, 'place'),
      glass: glasses + ice + tools > 0,
      team: team > 0,
      visibility: setupStepDone(run, 'visibility'),
      theme: looks,
      calendars: (calendars.data?.length ?? 0) > 0,
    },
    // A run from before 26 Oct that passed venue setup's old team step with nobody invited: still skipped.
    // A Kit skipped on the old checklist is Glassware's.
    [...(run?.skipped ?? []).map((k) => (k === 'kit' ? 'glass' : k)), ...((run?.done as readonly string[] | undefined)?.includes('team') ? ['team'] : [])]
  );
  const notes: Partial<Record<ChecklistKey, string>> = {
    claim: status === 'pending' && !page.data ? 'We’re checking it’s yours' : undefined,
    menu: menuNote(current.find((m) => m.itemIds.length > 0) ?? current[0]),
    glass: kitNote(glasses, ice, tools),
    team: team ? `${team} invited` : undefined,
  };
  return {
    run,
    list,
    notes,
    looks,
    loading: onPage.isLoading || iceList.isLoading || toolList.isLoading || menus.isLoading || invites.isLoading || members.isLoading || claim.isLoading || page.isLoading || brand.isLoading || calendars.isLoading,
    skip: (key: ChecklistKey) => save(barId, { skipped: [...new Set([...(run?.skipped ?? []), key])] }),
  };
}

/** The venue's setup run on this device, if it has one: whether "Set up <bar>" can show. */
export const useSetupRun = (barId: string | null | undefined) => useVenueSetup((s) => (barId ? s.runs[barId] : undefined));
