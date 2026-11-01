import { useUserId } from '@/ctx/AuthContext';
import { useBarMembers } from '@/hooks/useBarDetail';
import { useEndedRuns, type ListRow } from '@/hooks/useLivingList';
import { useMenuLibrary } from '@/hooks/useMenuMutations';
import type { MenuDetail } from '@/types/menus';

import { liveList, type LiveSection } from './liveList';

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** The menu team's view of a list that's on (liveList), with what it reads: runs ended, who asked, the drinks taken off. Off: the sections as they are. */
export function useLiveSections({ menu, sections, rows, may, on, living, now }: { menu: MenuDetail; sections: LiveSection[]; rows: ListRow[]; may: boolean; on: boolean; living: boolean; now: number }) {
  const userId = useUserId();
  const ended = useEndedRuns(on ? menu.id : null).data ?? [];
  const members = useBarMembers(on && rows.some((r) => r.state.startsWith('waiting')) ? menu.barId : null).data ?? [];
  // Names for drinks that left: today's struck rows, and the one a swap replaced in Last change.
  const library = useMenuLibrary(menu.barId, on && ended.length > 0).data ?? [];
  if (!on) return { lead: null, main: sections, coming: null, lastChange: null, ended };
  const first = (id: string | null) => members.find((m) => m.user_id === id)?.display_name?.split(' ')[0] ?? null;
  return {
    ...liveList({
      sections,
      sectionIds: new Map(menu.sections.map((s) => [s.name, s.id])),
      rows,
      ended,
      endedDrinks: new Map(library.filter((d) => ended.some((e) => e.itemId === d.id)).map((d) => [d.id, d])),
      may,
      living,
      userId,
      nameOf: (id) => (id === userId ? 'You' : first(id)),
      day,
      time,
      listStart: menu.startsAt,
      now,
    }),
    ended,
  };
}
