import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCreateMenu, useMenuLayouts } from '@/hooks/useMenuMutations';
import { useMenu } from '@/hooks/useMenus';
import { useMode } from '@/hooks/useMode';
import { useVenuePage } from '@/hooks/useVenueSetup';
import { blankSection, copySections, type MenuLayout } from '@/lib/menuLayout';
import { cardWhen, EMPTY_PLAN, groupMenus, homeMenuLine, homeNight, isSouthern, menuNameIdeas, venuePlan } from '@/lib/menus';
import type { MenuPhoto } from '@/lib/readMenu';
import type { MenuSummary } from '@/types/menus';

import { useStartBringIn } from '../bringin/useStartBringIn';
import { EMPTY_NIGHT } from './HomeNight';

export type Start = { kind: 'copy'; menuId: string } | { kind: 'layout'; layoutId: string } | { kind: 'photo' } | { kind: 'paste' } | { kind: 'blank' };

// Drink Creator and up build a venue's menus (private.can_write).
const BUILDS_MENUS = 35;

/**
 * What New menu knows and does, on a phone (the steps) and on a wide screen
 * (one page): who it's for, how it starts, its name and the ideas for one,
 * when it goes on, and making it. Photos go to Bring in, read as a menu and
 * checked there, which makes the menu; a pasted list opens the builder on
 * Paste a list, unless `pasted` names the drinks already (the desktop page).
 */
export function useNewMenu({ menus, now, onClose }: { menus: MenuSummary[]; now: number; onClose: () => void }) {
  const router = useRouter();
  const bringIn = useStartBringIn();
  const { venues, active } = useActiveVenue();
  // Home mode is like another account: a menu made there is always your own.
  const home = useMode().mode === 'home';
  // The venue you're in always counts: its Menus page only opens this when the
  // venue lets you build menus, which it can allow below Drink Creator.
  const buildable = home ? [] : venues.filter((v) => v.id === active?.id || v.roleLevel >= BUILDS_MENUS);
  const [barId, setBarId] = useState<string | null>(buildable.some((v) => v.id === active?.id) ? active!.id : (buildable[0]?.id ?? null));
  const venue = buildable.find((v) => v.id === barId) ?? null;
  const groups = groupMenus(
    menus.filter((m) => m.barId === barId),
    now
  );
  const copyable = [...groups.on, ...groups.upcoming, ...groups.draft, ...groups.previous];
  const { data: layouts = [] } = useMenuLayouts(barId);
  const [start, setStart] = useState<Start>({ kind: 'blank' });
  const { data: source } = useMenu(start.kind === 'copy' ? start.menuId : null);
  const create = useCreateMenu();
  const [name, setName] = useState('');
  const [photos, setPhotos] = useState<MenuPhoto[]>([]);
  const [night, setNight] = useState(EMPTY_NIGHT);
  const [plan, setPlan] = useState(EMPTY_PLAN);
  const [error, setError] = useState<string | null>(null);
  const page = useVenuePage(barId).data;

  const pickVenue = (id: string | null) => {
    setBarId(id);
    if (start.kind === 'copy' || start.kind === 'layout') setStart({ kind: 'blank' });
  };

  const copied = start.kind === 'copy' ? (copyable.find((m) => m.id === start.menuId) ?? null) : null;
  const layout = start.kind === 'layout' ? (layouts.find((l) => l.id === start.layoutId) ?? null) : null;
  // The season where the venue is (its page's latitude, else its zone; at home, this device's).
  const zone = page?.timezone ?? (home ? Intl.DateTimeFormat().resolvedOptions().timeZone : null);
  const at = plan.kind !== 'none' && plan.date ? new Date(`${plan.date}T12:00:00`) : new Date(now);
  const ideas = menuNameIdeas({ at, southern: isSouthern(page?.latitude, zone), copied: copied?.name });

  // For the card only; the night that's saved is worked out when the menu is made.
  const shownNight = home ? homeNight(night, now) : null;
  const shownPlan = home ? null : venuePlan(plan);
  const when =
    shownNight && !('error' in shownNight)
      ? homeMenuLine(shownNight, now)
      : shownPlan && !('error' in shownPlan)
        ? cardWhen({ startsAt: null, endsAt: null, menuDate: null, ...shownPlan })
        : null;

  /** What stops the draft being made (shown, and returned), or null. */
  const problem = (): string | null => {
    // From photos, the menu's printed title can name it.
    const whenSaved = home ? homeNight(night, Date.now()) : null;
    const planned = home ? null : venuePlan(plan);
    const found =
      !name.trim() && start.kind !== 'photo'
        ? 'Give the menu a name.'
        : whenSaved && 'error' in whenSaved
          ? whenSaved.error
          : planned && 'error' in planned
            ? planned.error
            : start.kind === 'photo' && !photos.length
              ? 'Add a photo of the menu first.'
              : null;
    setError(found);
    return found;
  };

  /** Makes the draft (or sends photos to Bring in). False, with `error` set, when something's missing. */
  const submit = async (pasted?: MenuLayout['sections']): Promise<boolean> => {
    if (problem()) return false;
    const whenSaved = home ? homeNight(night, Date.now()) : null;
    const planned = home ? null : venuePlan(plan);
    if ((whenSaved && 'error' in whenSaved) || (planned && 'error' in planned)) return false;
    let made: MenuLayout = { name, coverUrl: null, coverPosition: 50, sections: [blankSection()] };
    if (start.kind === 'photo') {
      onClose();
      // Read and checked by Bring in, as a menu, then made with the drinks it needs.
      bringIn([{ files: photos, text: null, url: null }], { as: 'menu', barId, menu: { name: name.trim(), night: whenSaved ?? null } });
      return true;
    }
    if (start.kind === 'copy') {
      if (!source) return (setError('Still loading that menu. Try again in a moment.'), false);
      made = { name, coverUrl: source.coverUrl, coverPosition: source.coverPosition, sections: copySections(source.sections, true) };
    } else if (layout?.sections.length) {
      made = { ...made, sections: copySections(layout.sections, false) };
    } else if (start.kind === 'paste' && pasted?.length) {
      made = { ...made, sections: pasted };
    }
    setError(null);
    try {
      const id = await create.mutateAsync({ barId, layout: made, night: whenSaved ?? undefined, plan: planned ?? undefined });
      onClose();
      router.push(`/menus/${id}/edit${start.kind === 'paste' && !pasted ? '?paste=1' : ''}`);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t make the menu. Try again.');
      return false;
    }
  };

  return {
    home,
    buildable,
    barId,
    venue,
    pickVenue,
    copyable,
    layouts,
    start,
    setStart,
    copied,
    layout,
    source,
    name,
    setName,
    ideas,
    photos,
    setPhotos,
    night,
    setNight,
    plan,
    setPlan,
    when,
    error,
    setError,
    problem,
    submit,
    pending: create.isPending,
  };
}

export type NewMenu = ReturnType<typeof useNewMenu>;
